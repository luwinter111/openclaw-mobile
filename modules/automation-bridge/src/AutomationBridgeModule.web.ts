import { NativeModule, registerWebModule } from 'expo';
import { UnavailabilityError } from 'expo-modules-core';

import type { GlobalAction, ScrollDirection } from './AutomationBridge.types';

const MODULE_NAME = 'AutomationBridge';

// Phone automation (accessibility service + gestures) only makes sense on a
// real device, and only Android exposes the necessary APIs to third-party
// apps. This stub exists so importing the module on web/iOS doesn't crash;
// every method throws instead of silently doing nothing.
class AutomationBridgeModule extends NativeModule<{}> {
  isAccessibilityServiceEnabled(): boolean {
    return false;
  }

  openAccessibilitySettings(): void {
    throw new UnavailabilityError(MODULE_NAME, 'openAccessibilitySettings');
  }

  async getUiTree(): Promise<string | null> {
    throw new UnavailabilityError(MODULE_NAME, 'getUiTree');
  }

  async performClick(_nodeId: string): Promise<boolean> {
    throw new UnavailabilityError(MODULE_NAME, 'performClick');
  }

  async performSetText(_nodeId: string, _text: string): Promise<boolean> {
    throw new UnavailabilityError(MODULE_NAME, 'performSetText');
  }

  async performScroll(_nodeId: string, _direction: ScrollDirection): Promise<boolean> {
    throw new UnavailabilityError(MODULE_NAME, 'performScroll');
  }

  async performGlobalAction(_action: GlobalAction): Promise<void> {
    throw new UnavailabilityError(MODULE_NAME, 'performGlobalAction');
  }
}

export default registerWebModule(AutomationBridgeModule, MODULE_NAME);
