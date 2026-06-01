// biome-ignore lint/suspicious/noControlCharactersInRegex: terminal control sequences
const CSI_REGEX =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><~]/g;

// biome-ignore lint/suspicious/noControlCharactersInRegex: OSC / hyperlinks
const OSC_REGEX = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

// biome-ignore lint/suspicious/noControlCharactersInRegex: charset / other ESC
const ESC_REGEX = /\u001b[PX^_][\s\S]|\u001b./g;

// biome-ignore lint/suspicious/noControlCharactersInRegex: C0 controls except tab/LF
const C0_EXCEPT_NEWLINE_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u007f]/g;

// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC starter at end of chunk
const ESC_TAIL_REGEX = /(?:\u001b|\u009b)[\s\S]*$/;

const PREVIEW_MAX_CHARS = 6000;
const PREVIEW_MAX_LINES = 18;

/** Strip ANSI/OSC and normalize PTY output for plain-text preview. */
export function stripTerminalOutput(text: string): string {
  if (!text) return '';

  let result = text
    .replace(OSC_REGEX, '')
    .replace(CSI_REGEX, '')
    .replace(ESC_REGEX, '')
    .replace(C0_EXCEPT_NEWLINE_REGEX, '');

  result = result
    .split('\n')
    .map((line) => {
      const parts = line.split('\r');
      return parts[parts.length - 1] ?? '';
    })
    .join('\n');

  return result;
}

function isCompleteEscapeTail(tail: string): boolean {
  if (!tail) return true;
  if (tail.startsWith('\u001b]')) {
    return tail.includes('\u0007') || tail.endsWith('\u001b\\');
  }
  if (tail.startsWith('\u001b[') || tail.startsWith('\u009b')) {
    return /[A-Za-z~]$/.test(tail);
  }
  if (tail === '\u001b' || tail === '\u009b') return false;
  return tail.length > 1;
}

/** Split trailing incomplete escape sequence (may span IPC chunks). */
export function peelIncompleteEscape(text: string): { body: string; pending: string } {
  if (!text) return { body: '', pending: '' };
  const match = text.match(ESC_TAIL_REGEX);
  if (!match) return { body: text, pending: '' };
  const tail = match[0];
  if (isCompleteEscapeTail(tail)) {
    return { body: text, pending: '' };
  }
  return { body: text.slice(0, -tail.length), pending: tail };
}

function safeSliceEnd(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  let start = text.length - maxChars;
  const code = text.charCodeAt(start);
  if (code >= 0xd800 && code <= 0xdbff) {
    start += 1;
  }
  return text.slice(start);
}

function appendStrippedText(current: string | undefined, chunk: string): string {
  if (!chunk) return current ?? '';
  let next = stripTerminalOutput((current ?? '') + chunk);
  if (next.length > PREVIEW_MAX_CHARS) {
    next = safeSliceEnd(next, PREVIEW_MAX_CHARS);
  }
  const lines = next.split('\n');
  return lines.slice(-PREVIEW_MAX_LINES).join('\n');
}

export interface TerminalPreviewChunkResult {
  previewText: string;
  escapePending: string;
}

/** Process one PTY chunk; keeps incomplete ESC bytes in `escapePending`. */
export function appendTerminalPreviewChunk(
  previewText: string | undefined,
  escapePending: string | undefined,
  chunk: string
): TerminalPreviewChunkResult {
  if (!chunk) {
    return { previewText: previewText ?? '', escapePending: escapePending ?? '' };
  }

  const { body, pending } = peelIncompleteEscape((escapePending ?? '') + chunk);
  return {
    previewText: appendStrippedText(previewText, body),
    escapePending: pending,
  };
}

/** @deprecated Use appendTerminalPreviewChunk for streaming PTY data. */
export function appendTerminalPreview(current: string | undefined, chunk: string): string {
  return appendTerminalPreviewChunk(current, '', chunk).previewText;
}
