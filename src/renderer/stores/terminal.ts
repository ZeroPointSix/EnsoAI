import type { TerminalSession } from '@shared/types';
import { create } from 'zustand';
import { appendTerminalPreview } from '@/lib/terminalPreview';

export type TerminalSessionEntry = TerminalSession & {
  previewText?: string;
};

interface TerminalState {
  sessions: TerminalSessionEntry[];
  activeSessionId: string | null;
  quickTerminalSessions: Record<string, string>; // worktreePath -> sessionId

  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  updateSession: (id: string, updates: Partial<TerminalSession>) => void;
  syncSessions: (sessions: TerminalSession[]) => void;
  appendTerminalPreview: (id: string, data: string) => void;

  // Quick Terminal session management
  setQuickTerminalSession: (worktreePath: string, sessionId: string) => void;
  getQuickTerminalSession: (worktreePath: string) => string | undefined;
  getAllQuickTerminalCwds: () => string[];
  removeQuickTerminalSession: (worktreePath: string) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  quickTerminalSessions: {},

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
    })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId:
        state.activeSessionId === id
          ? state.sessions.find((s) => s.id !== id)?.id || null
          : state.activeSessionId,
    })),
  setActiveSession: (id) => set({ activeSessionId: id }),
  updateSession: (id, updates) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  syncSessions: (sessions) =>
    set((state) => {
      const previewById = new Map(state.sessions.map((s) => [s.id, s.previewText]));
      return {
        sessions: sessions.map((s) => ({
          ...s,
          previewText: previewById.get(s.id),
        })),
      };
    }),

  appendTerminalPreview: (id, data) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === id);
      if (!session) return state;
      const previewText = appendTerminalPreview(session.previewText, data);
      if (!previewText || previewText === session.previewText) {
        return state;
      }
      return {
        sessions: state.sessions.map((s) => (s.id === id ? { ...s, previewText } : s)),
      };
    }),

  setQuickTerminalSession: (worktreePath, sessionId) =>
    set((state) => ({
      quickTerminalSessions: { ...state.quickTerminalSessions, [worktreePath]: sessionId },
    })),
  getQuickTerminalSession: (worktreePath) => get().quickTerminalSessions[worktreePath],
  getAllQuickTerminalCwds: () => Object.keys(get().quickTerminalSessions),
  removeQuickTerminalSession: (worktreePath) =>
    set((state) => {
      const { [worktreePath]: _, ...rest } = state.quickTerminalSessions;
      return { quickTerminalSessions: rest };
    }),
}));
