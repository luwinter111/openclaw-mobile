import NativeAutomationBridge from '../../modules/automation-bridge';
import type { UiNode } from '../../modules/automation-bridge';

export async function readUiTree(): Promise<UiNode | null> {
  const raw = await NativeAutomationBridge.getUiTree();
  if (!raw) return null;
  return JSON.parse(raw) as UiNode;
}

export const isAccessibilityServiceEnabled = () =>
  NativeAutomationBridge.isAccessibilityServiceEnabled();
export const openAccessibilitySettings = () => NativeAutomationBridge.openAccessibilitySettings();
export const hasScreenCapturePermission = () => NativeAutomationBridge.hasScreenCapturePermission();
export const requestScreenCapturePermission = () =>
  NativeAutomationBridge.requestScreenCapturePermission();
export const captureScreenshot = () => NativeAutomationBridge.captureScreenshot();
export const stopScreenCapture = () => NativeAutomationBridge.stopScreenCapture();

export { NativeAutomationBridge };
