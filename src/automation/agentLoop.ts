import { decideNextAction } from '../api/automationAgent';
import { buildScreenState } from './perception/buildScreenState';
import { executeAction } from './actions/executeAction';
import { isRiskyAction } from './actions/riskGuard';
import type { AutomationAction, RunTaskOptions, ScreenState, StepLog } from './types';

const DEFAULT_MAX_STEPS = 20;
const MAX_CONSECUTIVE_FAILURES = 3;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runAutomationTask(options: RunTaskOptions): Promise<void> {
  const { apiKey, model, instruction, onStep, onConfirmRequired, isAborted, maxSteps = DEFAULT_MAX_STEPS } =
    options;
  const history: StepLog[] = [];
  let consecutiveFailures = 0;

  const emit = (
    index: number,
    screenState: ScreenState | undefined,
    action: AutomationAction,
    ok: boolean,
    error?: string
  ) => {
    const step: StepLog = { index, screenState, action, ok, error, timestampMs: Date.now() };
    history.push(step);
    onStep?.(step);
  };

  for (let i = 0; i < maxSteps; i++) {
    if (isAborted?.()) return;

    let screenState: ScreenState;
    try {
      screenState = await buildScreenState();
    } catch (error) {
      emit(i, undefined, { type: 'done', summary: '无法读取屏幕，任务终止' }, false, describeError(error));
      return;
    }

    if (isAborted?.()) return;

    let action: AutomationAction;
    try {
      action = await decideNextAction({ apiKey, model, instruction, history, screenState });
    } catch (error) {
      emit(i, screenState, { type: 'done', summary: '模型决策失败，任务终止' }, false, describeError(error));
      return;
    }

    if (action.type === 'done') {
      emit(i, screenState, action, true);
      return;
    }

    if (isRiskyAction(action, screenState) && onConfirmRequired) {
      const confirmed = await onConfirmRequired(action, screenState);
      if (!confirmed) {
        emit(i, screenState, action, false, '用户取消了这个高风险操作，任务终止');
        return;
      }
    }

    try {
      await executeAction(action);
      emit(i, screenState, action, true);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      emit(i, screenState, action, false, describeError(error));
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        return;
      }
    }
  }
}
