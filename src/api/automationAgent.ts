import { AUTOMATION_SYSTEM_PROMPT, serializeTreeForPrompt } from '../automation/promptTemplates';
import type { AutomationAction, ScreenState, StepLog } from '../automation/types';
import { MissingApiKeyError } from './claude';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const HISTORY_WINDOW = 8;

const ACTION_TOOL = {
  name: 'perform_action',
  description: '基于当前屏幕状态，执行下一步操作。每次只返回一个动作。',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['click', 'setText', 'scroll', 'tap', 'swipe', 'globalAction', 'done'],
        description: '动作类型',
      },
      nodeId: { type: 'string', description: 'click/setText/scroll 时目标节点的 id（屏幕描述里的 [id]）' },
      text: { type: 'string', description: 'setText 时要输入的文本' },
      direction: { type: 'string', enum: ['forward', 'backward'], description: 'scroll 方向' },
      x: { type: 'number', description: 'tap/swipe 起点 x（像素，仅截图模式可用）' },
      y: { type: 'number', description: 'tap/swipe 起点 y' },
      x2: { type: 'number', description: 'swipe 终点 x' },
      y2: { type: 'number', description: 'swipe 终点 y' },
      durationMs: { type: 'number', description: 'swipe 持续时间（毫秒），默认 300' },
      action: { type: 'string', enum: ['back', 'home', 'recents'], description: 'globalAction 的具体动作' },
      summary: { type: 'string', description: 'done 时用一句话总结任务完成情况' },
      reason: { type: 'string', description: '简短说明为什么执行这个动作' },
    },
    required: ['type'],
  },
} as const;

function screenStateToContentBlocks(screenState: ScreenState): Array<Record<string, unknown>> {
  if (screenState.mode === 'tree') {
    return [
      {
        type: 'text',
        text: `当前屏幕（无障碍语义树，缩进表示层级，[id] 用于定位节点）：\n${serializeTreeForPrompt(
          screenState.tree
        )}`,
      },
    ];
  }
  return [
    { type: 'text', text: '当前屏幕截图如下（只能给出像素坐标，无法直接定位节点）：' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenState.imageBase64 } },
  ];
}

export function describeAction(action: AutomationAction): string {
  switch (action.type) {
    case 'click':
      return `点击节点 ${action.nodeId}`;
    case 'setText':
      return `在节点 ${action.nodeId} 输入 "${action.text}"`;
    case 'scroll':
      return `滚动节点 ${action.nodeId}（${action.direction}）`;
    case 'tap':
      return `点击坐标 (${action.x}, ${action.y})`;
    case 'swipe':
      return `滑动 (${action.x1},${action.y1}) -> (${action.x2},${action.y2})`;
    case 'globalAction':
      return `系统操作：${action.action}`;
    case 'done':
      return `完成：${action.summary}`;
  }
}

function historyToText(history: StepLog[]): string {
  if (history.length === 0) return '（还没有执行过任何动作）';
  return history
    .slice(-HISTORY_WINDOW)
    .map(
      (step, i) =>
        `${i + 1}. ${describeAction(step.action)} -> ${step.ok ? '成功' : `失败：${step.error ?? '未知错误'}`}`
    )
    .join('\n');
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseAction(input: Record<string, unknown>): AutomationAction {
  const reason = asString(input.reason);
  switch (input.type) {
    case 'click':
      if (typeof input.nodeId !== 'string') throw new Error('click 动作缺少 nodeId');
      return { type: 'click', nodeId: input.nodeId, reason };
    case 'setText':
      if (typeof input.nodeId !== 'string' || typeof input.text !== 'string') {
        throw new Error('setText 动作缺少 nodeId 或 text');
      }
      return { type: 'setText', nodeId: input.nodeId, text: input.text, reason };
    case 'scroll':
      if (typeof input.nodeId !== 'string') throw new Error('scroll 动作缺少 nodeId');
      return {
        type: 'scroll',
        nodeId: input.nodeId,
        direction: input.direction === 'backward' ? 'backward' : 'forward',
        reason,
      };
    case 'tap':
      if (typeof input.x !== 'number' || typeof input.y !== 'number') {
        throw new Error('tap 动作缺少 x/y');
      }
      return { type: 'tap', x: input.x, y: input.y, reason };
    case 'swipe':
      if (
        typeof input.x !== 'number' ||
        typeof input.y !== 'number' ||
        typeof input.x2 !== 'number' ||
        typeof input.y2 !== 'number'
      ) {
        throw new Error('swipe 动作缺少坐标');
      }
      return {
        type: 'swipe',
        x1: input.x,
        y1: input.y,
        x2: input.x2,
        y2: input.y2,
        durationMs: typeof input.durationMs === 'number' ? input.durationMs : undefined,
        reason,
      };
    case 'globalAction':
      if (input.action !== 'back' && input.action !== 'home' && input.action !== 'recents') {
        throw new Error('globalAction 动作缺少合法的 action');
      }
      return { type: 'globalAction', action: input.action, reason };
    case 'done':
      return { type: 'done', summary: asString(input.summary) ?? '任务已完成' };
    default:
      throw new Error(`模型返回了未知的动作类型：${String(input.type)}`);
  }
}

export async function decideNextAction(params: {
  apiKey: string;
  model: string;
  instruction: string;
  history: StepLog[];
  screenState: ScreenState;
}): Promise<AutomationAction> {
  const { apiKey, model, instruction, history, screenState } = params;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const userContent = [
    { type: 'text', text: `任务目标：${instruction}\n\n已执行的步骤：\n${historyToText(history)}` },
    ...screenStateToContentBlocks(screenState),
  ];

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: AUTOMATION_SYSTEM_PROMPT,
      tools: [ACTION_TOOL],
      tool_choice: { type: 'tool', name: 'perform_action' },
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${body || response.statusText}`);
  }

  const data = await response.json();
  const toolUse = (data.content as Array<Record<string, unknown>>).find(
    (block) => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new Error('模型没有返回可执行的动作。');
  }
  return parseAction(toolUse.input as Record<string, unknown>);
}
