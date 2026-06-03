import { useSettingsStore } from '@/stores/settings';

/** Default cap for canvas preview line buffer (was 80 — too little for scroll-back). */
export const CANVAS_PREVIEW_DEFAULT_MAX_LINES = 800;

/** Default cap for preview character buffer. */
export const CANVAS_PREVIEW_DEFAULT_MAX_CHARS = 512_000;

/** Hard ceiling to avoid renderer OOM on huge scrollback. */
export const CANVAS_PREVIEW_HARD_MAX_LINES = 2_000;

export const CANVAS_PREVIEW_HARD_MAX_CHARS = 1_024_000;

export function resolveCanvasPreviewMaxLines(terminalScrollback?: number): number {
  const scrollback =
    terminalScrollback ?? useSettingsStore.getState().terminalScrollback ?? 10_000;
  return Math.min(
    CANVAS_PREVIEW_HARD_MAX_LINES,
    Math.max(CANVAS_PREVIEW_DEFAULT_MAX_LINES, Math.floor(scrollback * 0.2))
  );
}

export function resolveCanvasPreviewMaxChars(): number {
  return CANVAS_PREVIEW_HARD_MAX_CHARS;
}
