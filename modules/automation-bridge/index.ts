// Re-export the native module. On web, it will be resolved to AutomationBridgeModule.web.ts
// and on native platforms to AutomationBridgeModule.ts
export { default } from './src/AutomationBridgeModule';
export * from './src/AutomationBridge.types';
