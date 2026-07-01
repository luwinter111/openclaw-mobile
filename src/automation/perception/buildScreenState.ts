import { readUiTree, captureScreenshot, hasScreenCapturePermission } from '../AutomationBridge';
import { isTreeUsable } from './isTreeUsable';
import type { ScreenState } from '../types';

export class ScreenUnreadableError extends Error {
  constructor() {
    super('无法读取当前屏幕：无障碍树不可用，并且没有开启录屏权限做兜底。');
    this.name = 'ScreenUnreadableError';
  }
}

export async function buildScreenState(): Promise<ScreenState> {
  const tree = await readUiTree();
  if (tree && isTreeUsable(tree)) {
    return { mode: 'tree', tree };
  }
  if (!hasScreenCapturePermission()) {
    throw new ScreenUnreadableError();
  }
  const imageBase64 = await captureScreenshot();
  return { mode: 'vision', imageBase64 };
}
