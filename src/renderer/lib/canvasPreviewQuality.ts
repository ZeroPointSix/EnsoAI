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

  if (
    /what'?s new/i.test(trimmed) &&
    (/welcome back/i.test(trimmed) || /tips for getting started/i.test(trimmed))
  ) {
    return true;
  }
  if (/welcome back!/i.test(trimmed) && /recent activity/i.test(trimmed)) {
    return true;
  }
  if (/api usage billing/i.test(trimmed) && /tips for getting started/i.test(trimmed)) {
    return true;
  }

  const compact = trimmed.replace(/\s+/g, '').toLowerCase();
  if (
    compact.length < 400 &&
    (/forshortcuts/i.test(compact) || /foragents/i.test(compact))
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
  const candidates = [runtime?.trim(), cached?.trim()].filter(Boolean) as string[];
  const good = candidates.filter((text) => !isLowSignalCanvasPreview(text));
  if (good.length === 0) return undefined;
  return good.sort((a, b) => b.length - a.length)[0];
}
