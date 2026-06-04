import type { SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { sessionCanvasLog } from '@/lib/sessionCanvasLog';
import { create } from 'zustand';

interface SessionCanvasStandaloneState {
  snapshot: SessionCanvasSnapshot | null;
  setSnapshot: (snapshot: SessionCanvasSnapshot) => void;
  clearSnapshot: () => void;
}

export const useSessionCanvasStandaloneStore = create<SessionCanvasStandaloneState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => {
    sessionCanvasLog('Standalone', 'store setSnapshot', { cardCount: snapshot.cards.length });
    set({ snapshot });
  },
  clearSnapshot: () => {
    sessionCanvasLog('Standalone', 'store clearSnapshot');
    set({ snapshot: null });
  },
}));
