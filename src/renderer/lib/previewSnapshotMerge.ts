import { isHighSignalCanvasPreview, isLowSignalCanvasPreview } from '@/lib/canvasPreviewQuality';

/** Whether incoming terminal preview should replace existing stored text. */
export function shouldApplyPreviewSnapshot(
  existing: string | undefined,
  incoming: string | null | undefined
): boolean {
  const next = incoming?.trim() ?? '';
  if (!next) return false;

  const prev = existing?.trim() ?? '';
  if (!prev) return true;

  if (next === prev) return false;
  if (prev.includes(next) && next.length < prev.length) return false;
  if (next.includes(prev)) return true;

  return next.length >= prev.length * 0.85;
}

/** Pick the better preview text when merging snapshot sync with stream buffer. */
export function mergePreviewSnapshot(
  existing: string | undefined,
  incoming: string | null | undefined
): string {
  if (!shouldApplyPreviewSnapshot(existing, incoming)) {
    return existing ?? '';
  }
  return incoming!.trim() ? incoming! : existing ?? '';
}

/**
 * Live xterm snapshot wins over streamed/cached preview (OpenCove-style).
 * Use when refreshing from mounted terminals so TUI redraws (e.g. Claude thinking → reply) are not blocked by longer stale text.
 */
export function mergeAuthoritativePreviewSnapshot(
  existing: string | undefined,
  incoming: string | null | undefined
): string {
  const next = incoming?.trim() ?? '';
  if (!next) return existing ?? '';

  const prev = existing?.trim() ?? '';
  if (isLowSignalCanvasPreview(next) && prev && !isLowSignalCanvasPreview(prev)) {
    return existing!;
  }

  return incoming!;
}

/**
 * 已挂载 xterm 时以屏幕快照为准（对齐 OpenCove presentationSnapshot / SerializeAddon 思路）。
 * 流式 PTY 在 Claude TUI 备用屏下常为乱码，不得阻止 xterm 刷新。
 */
export function mergeXtermCanvasPreview(
  existing: string | undefined,
  incoming: string | null | undefined
): string {
  return mergeAuthoritativePreviewSnapshot(existing, incoming);
}

/**
 * 看板定时从 xterm 刷新预览：不得用启动屏/旧快照覆盖 PTY 流式文本。
 */
export function mergeCanvasRefreshPreview(
  existing: string | undefined,
  incoming: string | null | undefined
): string {
  const next = incoming?.trim() ?? '';
  if (!next) return existing ?? '';
  const prev = existing?.trim() ?? '';
  if (!prev) return next;

  if (isHighSignalCanvasPreview(prev)) {
    if (!next || isLowSignalCanvasPreview(next)) return existing!;
    return mergePreviewSnapshot(existing, incoming) || existing!;
  }

  if (isLowSignalCanvasPreview(next)) {
    return !isLowSignalCanvasPreview(prev) ? (existing ?? '') : next;
  }
  if (isLowSignalCanvasPreview(prev)) return next;

  const prevTail = prev.slice(-100);
  if (prev.length > next.length + 48 && prevTail && !next.includes(prevTail.slice(-50))) {
    return existing ?? '';
  }

  return mergePreviewSnapshot(existing, incoming) || (existing ?? '');
}
