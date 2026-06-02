import { resolveSessionPtyId } from '@/stores/sessionPtyRegistry';
import { useTerminalWriteStore } from '@/stores/terminalWrite';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const inFlightBySession = new Set<string>();

function buildPayload(content: string, imagePaths: string[]): string {
  let message = content;
  if (imagePaths.length > 0) {
    const escapedPaths = imagePaths.map((p) => (p.includes(' ') ? `"${p}"` : p));
    message += `\n\n${escapedPaths.join(' ')}`;
  }
  return message;
}

async function writeChunks(
  sessionId: string,
  ptyId: string,
  writer: ((data: string) => void) | undefined,
  message: string
): Promise<void> {
  const writeChunk = (data: string) => {
    if (writer) {
      writer(data);
      return;
    }
    void window.electronAPI.terminal.write(ptyId, data);
  };

  const hasInternalNewlines = message.includes('\n');
  if (hasInternalNewlines) {
    writeChunk(`\x1b[200~${message}\x1b[201~`);
    await delay(300);
    writeChunk('\r');
  } else {
    writeChunk(message);
    await delay(30);
    writeChunk('\r');
  }
}

export async function sessionCanvasPtyExists(
  sessionId: string,
  ptyIdHint?: string
): Promise<boolean> {
  if (useTerminalWriteStore.getState().writers.has(sessionId)) {
    return true;
  }
  const ptyId = resolveSessionPtyId(sessionId, ptyIdHint);
  if (!ptyId) return false;
  try {
    return await window.electronAPI.terminal.exists(ptyId);
  } catch {
    return false;
  }
}

/**
 * Send a one-shot command to a session PTY from the session canvas quick input.
 * Prefers the xterm write bridge when mounted; falls back to IPC write with resolved `pty-N` id.
 */
export async function sendSessionCanvasQuickInput(
  sessionId: string,
  content: string,
  imagePaths: string[] = [],
  ptyIdHint?: string
): Promise<boolean> {
  const trimmed = content.trim();
  if (!trimmed && imagePaths.length === 0) return false;
  if (inFlightBySession.has(sessionId)) return false;

  const ptyId = resolveSessionPtyId(sessionId, ptyIdHint);
  const writer = useTerminalWriteStore.getState().writers.get(sessionId);

  if (!writer) {
    if (!ptyId) return false;
    const exists = await window.electronAPI.terminal.exists(ptyId);
    if (!exists) return false;
  }

  inFlightBySession.add(sessionId);
  try {
    const message = buildPayload(trimmed, imagePaths);
    await writeChunks(sessionId, ptyId ?? sessionId, writer, message);
    return true;
  } finally {
    inFlightBySession.delete(sessionId);
  }
}

export function hasSessionCanvasQuickInputWriter(sessionId: string): boolean {
  return useTerminalWriteStore.getState().writers.has(sessionId);
}
