import type { Terminal } from '@xterm/xterm';
import { stripTerminalOutput } from '@/lib/terminalPreview';

const SNAPSHOT_MAX_LINES = 120;
const SNAPSHOT_MAX_CHARS = 32_000;

function readBufferLines(
  buffer: { length: number; getLine: (index: number) => { translateToString: (trim?: boolean) => string } | undefined },
  maxLines: number
): string[] {
  const total = buffer.length;
  if (total === 0) return [];

  const start = Math.max(0, total - maxLines);
  const lines: string[] = [];

  for (let i = start; i < total; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    lines.push(line.translateToString(true));
  }

  return lines;
}

function trimSnapshotText(text: string): string {
  let next = text;
  if (next.length > SNAPSHOT_MAX_CHARS) {
    next = next.slice(-SNAPSHOT_MAX_CHARS);
  }
  const lineParts = next.split('\n');
  if (lineParts.length > SNAPSHOT_MAX_LINES) {
    next = lineParts.slice(-SNAPSHOT_MAX_LINES).join('\n');
  }
  return next.trimEnd();
}

/**
 * Read terminal screen for canvas preview (OpenCove uses SerializeAddon on a presentation session).
 * When the active buffer is alternate (TUI), also include normal scrollback so final output is not lost.
 */
export function readXtermBufferSnapshot(terminal: Terminal, maxLines = SNAPSHOT_MAX_LINES): string {
  const active = terminal.buffer.active;
  const normal = terminal.buffer.normal;
  const activeType = active.type;

  const half = Math.max(24, Math.floor(maxLines / 2));
  const parts: string[] = [];

  if (activeType === 'alternate' && normal.length > 0) {
    parts.push(...readBufferLines(normal, half));
  }

  parts.push(...readBufferLines(active, maxLines));

  const joined = stripTerminalOutput(parts.join('\n'));
  const trimmed = trimSnapshotText(joined);
  return trimmed;
}
