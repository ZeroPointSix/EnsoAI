import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';

/** 仅从预览文本识别「需用户确认」类 blocked（对齐 OpenCove：状态不靠预览猜 working） */
export function inferBlockedFromPreview(previewText: string | undefined): boolean {
  if (!previewText?.trim()) return false;

  const tail = previewText.slice(-4000);
  const lower = tail.toLowerCase();

  return (
    lower.includes('do you want to proceed?') ||
    lower.includes('would you like to proceed?') ||
    lower.includes('waiting for permission') ||
    lower.includes('do you want to allow this connection?') ||
    lower.includes('tab to amend') ||
    lower.includes('ctrl+e to explain')
  );
}

/** @deprecated 仅保留 blocked；working/idle 由 outputState + Hook 驱动 */
export function inferDisplayFromPreview(
  previewText: string | undefined
): CanvasAgentDisplayState | null {
  return inferBlockedFromPreview(previewText) ? 'blocked' : null;
}
