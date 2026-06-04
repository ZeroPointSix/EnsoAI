/** 看板卡片点击意图（纯函数，便于单测锁定交互习惯） */
export type SessionCanvasCardClickIntent = 'open-overlay' | 'jump-to-session';

export interface SessionCanvasCardClickInput {
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * 单击 → 浮层快捷输入；Ctrl/Cmd+单击 → 跳转主窗口会话。
 */
export function resolveSessionCanvasCardClickIntent(
  input: SessionCanvasCardClickInput
): SessionCanvasCardClickIntent {
  if (input.ctrlKey || input.metaKey) return 'jump-to-session';
  return 'open-overlay';
}
