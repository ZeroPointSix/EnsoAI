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
  _existing: string | undefined,
  incoming: string | null | undefined
): string {
  const next = incoming?.trim() ?? '';
  if (!next) return _existing ?? '';
  return incoming!;
}
