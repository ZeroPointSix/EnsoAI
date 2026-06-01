import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useTerminalStore } from '@/stores/terminal';

/** Pull latest text from live xterm buffers into canvas preview stores. */
export function refreshAllCanvasPreviews(): void {
  useAgentSessionsStore.getState().refreshCanvasPreviewsFromTerminals();
  useTerminalStore.getState().refreshCanvasPreviewsFromTerminals();
}
