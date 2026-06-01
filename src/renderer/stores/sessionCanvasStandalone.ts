import type { SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { create } from 'zustand';

interface SessionCanvasStandaloneState {
  snapshot: SessionCanvasSnapshot | null;
  setSnapshot: (snapshot: SessionCanvasSnapshot) => void;
  clearSnapshot: () => void;
}

export const useSessionCanvasStandaloneStore = create<SessionCanvasStandaloneState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  clearSnapshot: () => set({ snapshot: null }),
}));
