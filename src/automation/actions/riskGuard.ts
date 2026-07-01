import type { UiNode } from '../../../modules/automation-bridge';
import type { AutomationAction, ScreenState } from '../types';

const RISK_KEYWORDS = [
  '支付',
  '付款',
  '转账',
  '汇款',
  '删除',
  '清空',
  '卸载',
  '格式化',
  '重置',
  '确认支付',
  '立即支付',
  'pay',
  'payment',
  'transfer',
  'delete',
  'uninstall',
  'purchase',
  'buy now',
];

function findNode(node: UiNode, id: string): UiNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function nodeLabel(node: UiNode): string {
  return `${node.text ?? ''} ${node.contentDescription ?? ''}`.trim().toLowerCase();
}

// Only checks the 'click' case: that's the action type actually reachable
// from a labeled tree node. tap/swipe only carry pixel coordinates (no text
// to inspect), and setText/scroll aren't the kind of one-shot destructive
// action this guard is meant to catch.
export function isRiskyAction(action: AutomationAction, screenState: ScreenState): boolean {
  if (action.type !== 'click' || screenState.mode !== 'tree') return false;
  const node = findNode(screenState.tree, action.nodeId);
  if (!node) return false;
  const label = nodeLabel(node);
  return RISK_KEYWORDS.some((keyword) => label.includes(keyword.toLowerCase()));
}
