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

  async performTap(_x: number, _y: number): Promise<boolean> {
    throw new UnavailabilityError(MODULE_NAME, 'performTap');
  }

  async performSwipe(_x1: number, _y1: number, _x2: number, _y2: number, _durationMs?: number): Promise<boolean> {
    throw new UnavailabilityError(MODULE_NAME, 'performSwipe');
  }

  hasScreenCapturePermission(): boolean {
    return false;
  }

  async requestScreenCapturePermission(): Promise<boolean> {
    throw new UnavailabilityError(MODULE_NAME, 'requestScreenCapturePermission');
  }

  async captureScreenshot(): Promise<string> {
    throw new UnavailabilityError(MODULE_NAME, 'captureScreenshot');
  }

  stopScreenCapture(): void {
    throw new UnavailabilityError(MODULE_NAME, 'stopScreenCapture');
  }
}

export default registerWebModule(AutomationBridgeModule, MODULE_NAME);
