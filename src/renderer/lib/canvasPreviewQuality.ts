/**
 * Detect Claude Code / TUI idle screens that look like content but carry no session signal.
 * Used so canvas cards prefer real output over welcome chrome.
 */
export function isLowSignalCanvasPreview(text: string | undefined): boolean {
  if (!text?.trim()) return true;

  const trimmed = text.trim();
  const withoutDecor = trimmed.replace(/[\s\u2500-\u257f·•*?←→│─┌┐└┘├┤┬┴┼─═║╔╗╚╝╠╣╦╩╬]/g, '');
  if (withoutDecor.length < 12 && trimmed.length < 280) {
    if (/for shortcuts/i.test(trimmed) || /for agents/i.test(trimmed)) {
      return true;
    }
    if (/^[* ]*claude code/i.test(trimmed) && trimmed.length < 120) {
      return true;
    }
  }

  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  if (
    lines.length <= 4 &&
    (/(?:\?|←)\s*for shortcuts/i.test(trimmed) || /for agents/i.test(trimmed))
  ) {
    return true;
  }

  return false;
}

/** Pick text to show on canvas cards (runtime vs durable cache). */
export function resolveCanvasCardPreviewText(
  runtime?: string,
  cached?: string
): string | undefined {
  const r = runtime?.trim();
  const c = cached?.trim();

  const rOk = r && !isLowSignalCanvasPreview(r);
  const cOk = c && !isLowSignalCanvasPreview(c);
  if (rOk) return r;
  if (cOk) return c;
  return undefined;
}
