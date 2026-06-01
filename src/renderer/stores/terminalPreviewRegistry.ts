import { readXtermBufferSnapshot } from '@/lib/xtermBufferSnapshot';
import type { Terminal } from '@xterm/xterm';

type PreviewReader = () => string | null;

const readers = new Map<string, PreviewReader>();

export function registerTerminalPreviewReader(sessionId: string, reader: PreviewReader): () => void {
  readers.set(sessionId, reader);
  return () => {
    readers.delete(sessionId);
  };
}

export function registerXtermPreviewReader(sessionId: string, getTerminal: () => Terminal | null): () => void {
  return registerTerminalPreviewReader(sessionId, () => {
    const terminal = getTerminal();
    if (!terminal) return null;
    const snapshot = readXtermBufferSnapshot(terminal);
    return snapshot || null;
  });
}

export function snapshotTerminalPreview(sessionId: string): string | null {
  return readers.get(sessionId)?.() ?? null;
}
