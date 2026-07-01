import type { UiNode } from '../../modules/automation-bridge';

const MAX_TEXT_LENGTH = 60;
const MAX_LINES = 400;

function truncate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_TEXT_LENGTH ? `${trimmed.slice(0, MAX_TEXT_LENGTH)}…` : trimmed;
}

function describeNode(node: UiNode): string {
  const parts: string[] = [];
  const text = truncate(node.text);
  const desc = truncate(node.contentDescription);
  if (text) parts.push(`text="${text}"`);
  if (desc && desc !== text) parts.push(`desc="${desc}"`);
  if (node.viewId) parts.push(`view=${node.viewId.split('/').pop()}`);
  if (node.clickable) parts.push('clickable');
  if (node.editable) parts.push('editable');
  return parts.join(' ');
}

function serializeNode(node: UiNode, lines: string[], depth: number): void {
  const description = describeNode(node);
  // Pure layout containers (no text/id/interactivity) just add noise to the
  // prompt without helping the model locate anything — skip the line but
  // keep walking their children at the same depth.
  const isNoise = description.length === 0 && node.children.length > 0;
  if (!isNoise) {
    lines.push(`${'  '.repeat(depth)}[${node.id}] ${description || node.className || ''}`);
  }
  const childDepth = isNoise ? depth : depth + 1;
  for (const child of node.children) {
    if (lines.length >= MAX_LINES) return;
    serializeNode(child, lines, childDepth);
  }
}

export function serializeTreeForPrompt(tree: UiNode): string {
  const lines: string[] = [];
  serializeNode(tree, lines, 0);
  return lines.slice(0, MAX_LINES).join('\n');
}

export const AUTOMATION_SYSTEM_PROMPT = `你是运行在用户 Android 手机上的自动化助理，通过读取屏幕内容并执行点击/输入/滚动/手势来帮用户完成任务。

规则：
- 每一步只能调用一次 perform_action 工具，返回恰好一个动作。
- 优先使用 nodeId 定位元素（click/setText/scroll），只有在收到的是截图（而不是无障碍树）时才使用像素坐标（tap/swipe）。
- 任务已经达成、或者你判断继续下去没有意义（比如反复失败、界面卡住）时，返回 type="done"，并在 summary 中用一句话说明结果。
- 涉及支付、转账、删除、卸载等有风险的操作前，如果可以选择更安全的路径（比如先查看确认信息），优先选择安全路径；如果必须执行风险操作，如实描述在 reason 中，系统会先向用户确认。
- 不要编造屏幕上不存在的元素或内容；如果看不清楚，就返回 done 并说明原因。`;
