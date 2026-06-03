/** Distance from bottom (px) within which preview auto-scroll stays enabled. */
export const PREVIEW_STICK_TO_BOTTOM_THRESHOLD = 50;

export function isPreviewStickToBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold = PREVIEW_STICK_TO_BOTTOM_THRESHOLD
): boolean {
  return scrollHeight - scrollTop - clientHeight < threshold;
}
