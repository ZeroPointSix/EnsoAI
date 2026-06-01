import { useAgentSessionsStore } from '@/stores/agentSessions';
import { getCachedSessionPreview } from '@/stores/sessionPreviewCache';
import { useTerminalStore } from '@/stores/terminal';

/** Restore previews from durable cache when runtime store is empty. */
function hydratePreviewsFromCache(): void {
  const agentStore = useAgentSessionsStore.getState();
  for (const session of agentStore.sessions) {
    const cached = getCachedSessionPreview('agent', session.id);
    if (!cached?.trim()) continue;
    const runtime = agentStore.runtimeStates[session.id];
    if (!runtime?.previewText?.trim()) {
      agentStore.setSessionPreview(session.id, cached);
    }
  }

  const terminalStore = useTerminalStore.getState();
  for (const session of terminalStore.sessions) {
    const cached = getCachedSessionPreview('terminal', session.id);
    if (!cached?.trim()) continue;
    if (!session.previewText?.trim()) {
      terminalStore.setSessionPreview(session.id, cached);
    }
  }
}

/** Pull latest text from live xterm buffers into canvas preview stores. */
export function refreshAllCanvasPreviews(): void {
  hydratePreviewsFromCache();
  useAgentSessionsStore.getState().refreshCanvasPreviewsFromTerminals();
  useTerminalStore.getState().refreshCanvasPreviewsFromTerminals();
}
