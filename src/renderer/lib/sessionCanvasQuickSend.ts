import { useTerminalWriteStore } from '@/stores/terminalWrite';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  writer: ((data: string) => void) | undefined,
  message: string
): Promise<void> {
  const writeChunk = (data: string) => {
    if (writer) {
      writer(data);
      return;
    }
    void window.electronAPI.terminal.write(sessionId, data);
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

export async function sessionCanvasPtyExists(sessionId: string): Promise<boolean> {
  try {
    return await window.electronAPI.terminal.exists(sessionId);
  } catch {
    return false;
  }
}

/**
 * Send a one-shot command to a session PTY from the session canvas quick input.
 * Prefers the xterm write bridge when mounted; falls back to IPC write (standalone canvas window).
 */
export async function sendSessionCanvasQuickInput(
  sessionId: string,
  content: string,
  imagePaths: string[] = []
): Promise<boolean> {
  const trimmed = content.trim();
  if (!trimmed && imagePaths.length === 0) return false;

  const exists = await sessionCanvasPtyExists(sessionId);
  if (!exists) return false;

  const message = buildPayload(trimmed, imagePaths);
  const writer = useTerminalWriteStore.getState().writers.get(sessionId);
  await writeChunks(sessionId, writer, message);
  return true;
}

export function hasSessionCanvasQuickInputWriter(sessionId: string): boolean {
  return useTerminalWriteStore.getState().writers.has(sessionId);
}
