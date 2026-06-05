import { sessionCanvasLog, shortSessionId } from '@/lib/sessionCanvasLog';
import { useAgentRuntimeActivityStore } from '@/stores/agentRuntimeActivity';
import { resolveSessionPtyId } from '@/stores/sessionPtyRegistry';
import { useTerminalWriteStore } from '@/stores/terminalWrite';

function focusSessionTerminal(sessionId: string): void {
  useTerminalWriteStore.getState().focus(sessionId);
}

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

function buildRelayRequestId(sessionId: string): string {
  return `sc-arm-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    if (!ptyId) {
      sessionCanvasLog('QuickInput', 'send failed: no ptyId', {
        sessionId: shortSessionId(sessionId),
      });
      return false;
    }
    const exists = await window.electronAPI.terminal.exists(ptyId);
    if (!exists) {
      sessionCanvasLog('QuickInput', 'send failed: pty not exists', {
        sessionId: shortSessionId(sessionId),
        ptyId,
      });
      return false;
    }
  }

  inFlightBySession.add(sessionId);
  try {
    const message = buildPayload(trimmed, imagePaths);
    const requestId = buildRelayRequestId(sessionId);
    sessionCanvasLog('QuickInput', 'relay armCpuWake start', {
      requestId,
      sessionId: shortSessionId(sessionId),
    });
    const relayed = await window.electronAPI.sessionCanvasPanel.relayArmCpuWake({
      requestId,
      sessionId,
      reason: 'quick-input',
    });
    sessionCanvasLog('QuickInput', 'relay armCpuWake done', {
      requestId,
      sessionId: shortSessionId(sessionId),
      relayed,
    });
    useAgentRuntimeActivityStore.getState().armCpuWake(sessionId, 'quick-input');
    sessionCanvasLog('QuickInput', 'send', {
      sessionId: shortSessionId(sessionId),
      ptyId,
      hasWriter: Boolean(writer),
      chars: message.length,
      images: imagePaths.length,
    });
    await writeChunks(sessionId, ptyId ?? sessionId, writer, message);
    if (writer) {
      focusSessionTerminal(sessionId);
    }
    return true;
  } finally {
    inFlightBySession.delete(sessionId);
  }
}

export function hasSessionCanvasQuickInputWriter(sessionId: string): boolean {
  return useTerminalWriteStore.getState().writers.has(sessionId);
}
