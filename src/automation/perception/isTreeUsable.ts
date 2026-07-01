import type { UiNode } from '../../../modules/automation-bridge';

function flatten(node: UiNode, acc: UiNode[]): UiNode[] {
  acc.push(node);
  for (const child of node.children) flatten(child, acc);
  return acc;
}

// Heuristic for "is this accessibility tree actually useful, or should we
// fall back to a screenshot": a tree with almost no nodes is probably a
// custom-drawn view (Canvas/game/some WebViews) that didn't bother exposing
// semantics, and a tree where interactive elements have no label at all
// gives the model nothing to reason about beyond raw coordinates anyway.
export function isTreeUsable(tree: UiNode): boolean {
  const nodes = flatten(tree, []);
  const interactive = nodes.filter((n) => n.clickable || n.editable);
  const labeled = interactive.filter((n) => n.text || n.contentDescription || n.viewId);
  return nodes.length > 3 && (interactive.length === 0 || labeled.length / interactive.length > 0.5);
}
