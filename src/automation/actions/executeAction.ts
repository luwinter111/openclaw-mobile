import { NativeAutomationBridge } from '../AutomationBridge';
import type { AutomationAction } from '../types';

export async function executeAction(action: AutomationAction): Promise<void> {
  switch (action.type) {
    case 'click':
      await NativeAutomationBridge.performClick(action.nodeId);
      return;
    case 'setText':
      await NativeAutomationBridge.performSetText(action.nodeId, action.text);
      return;
    case 'scroll':
      await NativeAutomationBridge.performScroll(action.nodeId, action.direction);
      return;
    case 'tap':
      await NativeAutomationBridge.performTap(action.x, action.y);
      return;
    case 'swipe':
      await NativeAutomationBridge.performSwipe(
        action.x1,
        action.y1,
        action.x2,
        action.y2,
        action.durationMs
      );
      return;
    case 'globalAction':
      await NativeAutomationBridge.performGlobalAction(action.action);
      return;
    case 'done':
      return;
  }
}
