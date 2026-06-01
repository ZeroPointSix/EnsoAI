// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require ESC character
const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;?]*[a-zA-Z]/g;

const PREVIEW_MAX_CHARS = 6000;
const PREVIEW_MAX_LINES = 18;

/** Append terminal output chunk and keep the last N lines for canvas preview. */
export function appendTerminalPreview(current: string | undefined, chunk: string): string {
  const stripped = chunk.replace(ANSI_ESCAPE_REGEX, '');
  if (!stripped) return current ?? '';

  let next = (current ?? '') + stripped;
  if (next.length > PREVIEW_MAX_CHARS) {
    next = next.slice(-PREVIEW_MAX_CHARS);
  }

  const lines = next.split(/\r?\n/);
  return lines.slice(-PREVIEW_MAX_LINES).join('\n');
}
