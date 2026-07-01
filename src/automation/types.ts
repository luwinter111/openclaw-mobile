import type { UiNode } from '../../modules/automation-bridge';

export type ScreenState = { mode: 'tree'; tree: UiNode } | { mode: 'vision'; imageBase64: string };

export type AutomationAction =
  | { type: 'click'; nodeId: string; reason?: string }
  | { type: 'setText'; nodeId: string; text: string; reason?: string }
  | { type: 'scroll'; nodeId: string; direction: 'forward' | 'backward'; reason?: string }
  | { type: 'tap'; x: number; y: number; reason?: string }
  | { type: 'swipe'; x1: number; y1: number; x2: number; y2: number; durationMs?: number; reason?: string }
  | { type: 'globalAction'; action: 'back' | 'home' | 'recents'; reason?: string }
  | { type: 'done'; summary: string };

export interface StepLog {
  index: number;
  screenState?: ScreenState;
  action: AutomationAction;
  ok: boolean;
  error?: string;
  timestampMs: number;
}

export interface RunTaskOptions {
  apiKey: string;
  model: string;
  instruction: string;
  maxSteps?: number;
  onStep?: (step: StepLog) => void;
  onConfirmRequired?: (action: AutomationAction, screenState: ScreenState) => Promise<boolean>;
  isAborted?: () => boolean;
}
