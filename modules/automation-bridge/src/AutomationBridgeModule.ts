import type { NativeModule } from 'expo';
import { requireOptionalNativeModule, UnavailabilityError } from 'expo-modules-core';

import type { GlobalAction, ScrollDirection } from './AutomationBridge.types';

interface AutomationBridgeModuleType extends NativeModule<{}> {
  isAccessibilityServiceEnabled(): boolean;
  openAccessibilitySettings(): void;

  // Returns the current window's accessibility tree as a raw JSON string
  // (parse it with JSON.parse into a UiNode), or null if the service isn't
  // connected yet / there's no active window.
  getUiTree(): Promise<string | null>;

  performClick(nodeId: string): Promise<boolean>;
  performSetText(nodeId: string, text: string): Promise<boolean>;
  performScroll(nodeId: string, direction: ScrollDirection): Promise<boolean>;
  performGlobalAction(action: GlobalAction): Promise<void>;
}

const MODULE_NAME = 'AutomationBridge';

function unavailable(methodName: string): never {
  throw new UnavailabilityError(MODULE_NAME, methodName);
}

// `requireOptionalNativeModule` (not `requireNativeModule`) so simply *importing*
// this file never throws. This module only exists in a custom dev client /
// standalone build — under Expo Go (which can't bundle arbitrary custom native
// modules) `nativeModule` is null, and callers get a clear "unavailable" error
// only if they actually invoke a method, instead of the whole app crashing on
// startup because RootNavigator eagerly imports every screen.
const nativeModule = requireOptionalNativeModule<AutomationBridgeModuleType>(MODULE_NAME);

const fallback = {
  isAccessibilityServiceEnabled: () => false,
  openAccessibilitySettings: () => unavailable('openAccessibilitySettings'),
  getUiTree: async () => unavailable('getUiTree'),
  performClick: async () => unavailable('performClick'),
  performSetText: async () => unavailable('performSetText'),
  performScroll: async () => unavailable('performScroll'),
  performGlobalAction: async () => unavailable('performGlobalAction'),
} as unknown as AutomationBridgeModuleType;

export default nativeModule ?? fallback;
