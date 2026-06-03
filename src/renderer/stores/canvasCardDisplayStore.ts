import { normalizePath } from '@shared/utils/path';
import { create } from 'zustand';
import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';
import { useAgentSessionsStore } from './agentSessions';

/** 任务完成绿灯保持时长（用户配置：1 分钟） */
const COMPLETED_TTL_MS = 60_000;

function resolveEnsoSessionId(incomingSessionId: string, cwd?: string): string | null {
  const sessions = useAgentSessionsStore.getState().sessions;
  const matched = sessions.find(
    (s) => s.id === incomingSessionId || s.sessionId === incomingSessionId
  );
  if (matched) return matched.id;
  if (cwd) {
    const normalized = normalizePath(cwd);
    const byCwd = sessions.find((s) => normalizePath(s.cwd) === normalized);
    if (byCwd) return byCwd.id;
  }
  return null;
}

interface CanvasCardDisplayStore {
  bySessionId: Record<string, CanvasAgentDisplayState>;
  setDisplayState: (sessionId: string, state: CanvasAgentDisplayState) => void;
  clearSession: (sessionId: string) => void;
}

const completedTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearCompletedTimer(sessionId: string): void {
  const existing = completedTimers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    completedTimers.delete(sessionId);
  }
}

export const useCanvasCardDisplayStore = create<CanvasCardDisplayStore>((set, get) => ({
  bySessionId: {},

  setDisplayState: (sessionId, state) => {
    clearCompletedTimer(sessionId);

    set((prev) => ({
      bySessionId: { ...prev.bySessionId, [sessionId]: state },
    }));

    if (state === 'completed') {
      const timer = setTimeout(() => {
        completedTimers.delete(sessionId);
        const current = get().bySessionId[sessionId];
        if (current === 'completed') {
          set((prev) => ({
            bySessionId: { ...prev.bySessionId, [sessionId]: 'idle' },
          }));
        }
      }, COMPLETED_TTL_MS);
      completedTimers.set(sessionId, timer);
    }
  },

  clearSession: (sessionId) => {
    clearCompletedTimer(sessionId);
    set((prev) => {
      const { [sessionId]: _, ...rest } = prev.bySessionId;
      return { bySessionId: rest };
    });
  },
}));

/** 仅在看板 Panel 挂载时注册，按 sessionId 更新四色状态 */
export function initCanvasCardDisplayListeners(): () => void {
  const { setDisplayState } = useCanvasCardDisplayStore.getState();

  const applyHookState = (
    incomingSessionId: string | undefined,
    cwd: string | undefined,
    state: CanvasAgentDisplayState
  ) => {
    if (!incomingSessionId) return;
    const sessionId = resolveEnsoSessionId(incomingSessionId, cwd);
    if (sessionId) setDisplayState(sessionId, state);
  };

  const unsubPre = window.electronAPI.notification.onPreToolUse((data) => {
    applyHookState(data.sessionId, data.cwd, 'working');
  });

  const unsubAsk = window.electronAPI.notification.onAskUserQuestion((data) => {
    applyHookState(data.sessionId, data.cwd, 'blocked');
  });

  const unsubStop = window.electronAPI.notification.onAgentStop((data) => {
    applyHookState(data.sessionId, data.cwd, 'completed');
  });

  return () => {
    unsubPre();
    unsubAsk();
    unsubStop();
  };
}
