import { create } from 'zustand';
import { sessionCanvasLog, shortSessionId } from '@/lib/sessionCanvasLog';

/**
 * Maps UI session id (agent session.id / terminal tab id) → main-process PTY id (`pty-N`).
 * PtyManager never uses session.id as the PTY key; canvas quick input must resolve this.
 */
interface SessionPtyRegistryState {
  ptyBySessionId: Record<string, string>;
  setPtyId: (sessionId: string, ptyId: string) => void;
  clearPtyId: (sessionId: string) => void;
  getPtyId: (sessionId: string) => string | undefined;
}

export const useSessionPtyRegistry = create<SessionPtyRegistryState>((set, get) => ({
  ptyBySessionId: {},

  setPtyId: (sessionId, ptyId) => {
    sessionCanvasLog('PtyRegistry', 'setPtyId', {
      sessionId: shortSessionId(sessionId),
      ptyId,
    });
    set((state) => ({
      ptyBySessionId: { ...state.ptyBySessionId, [sessionId]: ptyId },
    }));
  },

  clearPtyId: (sessionId) => {
    sessionCanvasLog('PtyRegistry', 'clearPtyId', { sessionId: shortSessionId(sessionId) });
    set((state) => {
      const next = { ...state.ptyBySessionId };
      delete next[sessionId];
      return { ptyBySessionId: next };
    });
  },

  getPtyId: (sessionId) => get().ptyBySessionId[sessionId],
}));

export function resolveSessionPtyId(sessionId: string, ptyIdHint?: string): string | undefined {
  return ptyIdHint ?? useSessionPtyRegistry.getState().getPtyId(sessionId);
}
