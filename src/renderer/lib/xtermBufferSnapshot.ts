import type { Terminal } from '@xterm/xterm';
import { stripTerminalOutput } from '@/lib/terminalPreview';

const SNAPSHOT_MAX_LINES = 80;

/** Read visible lines from an xterm buffer for canvas preview sync. */
export function readXtermBufferSnapshot(terminal: Terminal, maxLines = SNAPSHOT_MAX_LINES): string {
  const buffer = terminal.buffer.active;
  const total = buffer.length;
  if (total === 0) return '';

  const start = Math.max(0, total - maxLines);
  const lines: string[] = [];

  for (let i = start; i < total; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    const text = stripTerminalOutput(line.translateToString(true));
    if (text.trim()) {
      lines.push(text);
    }
  }

  return lines.join('\n');
}
