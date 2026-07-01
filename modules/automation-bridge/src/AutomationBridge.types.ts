export interface UiNodeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface UiNode {
  id: string;
  text: string | null;
  contentDescription: string | null;
  className: string | null;
  viewId: string | null;
  clickable: boolean;
  editable: boolean;
  bounds: UiNodeBounds;
  children: UiNode[];
}

export type ScrollDirection = 'forward' | 'backward';

export type GlobalAction = 'back' | 'home' | 'recents';
