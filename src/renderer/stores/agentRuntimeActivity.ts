import { create } from 'zustand';

/**
 * 统一 Agent Runtime Activity 状态机。
 *
 * 设计原则：
 * - 以 PTY 进程活跃度为主信号（对所有 Agent 通用）
 * - 终端输出为辅助信号（刷新 lastOutputAt）
 * - Claude Hook 等语义事件为增强信号（blocked/completed 精确边界）
 * - 不依赖按 Enter、输出阈值等条件
 */

/** Agent 运行阶段 */
export type AgentRuntimePhase = 'idle' | 'running' | 'blocked' | 'completed';

/** 状态来源 */
export type ActivitySource = 'pty' | 'output' | 'hook' | 'manual' | 'inferred';

/** 单个 Session 的 runtime activity */
export interface AgentRuntimeActivity {
  phase: AgentRuntimePhase;
  lastOutputAt: number;
  lastCpuActiveAt: number;
  lastStartedAt: number;
  lastCompletedAt: number;
  source: ActivitySource;
}

/** 完成态保持时长（绿灯 60 秒后退回 idle） */
const COMPLETED_TTL_MS = 60_000;

/** CPU 空闲判定窗口：连续 N 毫秒无 CPU + 无输出 → 可判 idle */
const IDLE_THRESHOLD_MS = 3_000;

interface AgentRuntimeActivityState {
  activities: Record<string, AgentRuntimeActivity>;

  /** PTY 进程活跃 → running */
  reportCpuActive: (sessionId: string) => void;

  /** 终端收到输出 → running（仅当当前不是 blocked 时） */
  reportOutput: (sessionId: string) => void;

  /** Hook 语义事件：running */
  reportHookRunning: (sessionId: string) => void;

  /** Hook 语义事件：blocked */
  reportHookBlocked: (sessionId: string) => void;

  /** Hook 语义事件：completed */
  reportHookCompleted: (sessionId: string) => void;

  /** 轮询检查：无 CPU 活跃且无近期输出的 session → idle 或 completed */
  tickIdleCheck: (now: number) => void;

  /** 用户查看 session → 若 completed 则回到 idle */
  markViewed: (sessionId: string) => void;

  /** 清理 session */
  clearSession: (sessionId: string) => void;

  /** 读取单个 session 的 phase */
  getPhase: (sessionId: string) => AgentRuntimePhase;
}

const completedTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearCompletedTimer(sessionId: string): void {
  const existing = completedTimers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    completedTimers.delete(sessionId);
  }
}

function defaultActivity(): AgentRuntimeActivity {
  return {
    phase: 'idle',
    lastOutputAt: 0,
    lastCpuActiveAt: 0,
    lastStartedAt: 0,
    lastCompletedAt: 0,
    source: 'manual',
  };
}

export const useAgentRuntimeActivityStore = create<AgentRuntimeActivityState>((set, get) => ({
  activities: {},

  reportCpuActive: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      // blocked 状态不由 PTY CPU 活跃覆盖（需要 Hook 解除）
      if (current.phase === 'blocked') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastCpuActiveAt: now } } };
      }
      // completed 状态也不由 PTY CPU 活跃覆盖（需要 60s TTL 或新 running Hook）
      if (current.phase === 'completed') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastCpuActiveAt: now } } };
      }
      if (current.phase === 'running') {
        // 已经 running，只刷新时间戳
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastCpuActiveAt: now } } };
      }
      // idle → running
      return {
        activities: {
          ...prev.activities,
          [sessionId]: { ...current, phase: 'running', lastCpuActiveAt: now, lastStartedAt: now, source: 'pty' },
        },
      };
    });
  },

  reportOutput: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      // blocked/completed 不被输出覆盖
      if (current.phase === 'blocked' || current.phase === 'completed') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastOutputAt: now } } };
      }
      if (current.phase === 'running') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastOutputAt: now } } };
      }
      // idle → running
      return {
        activities: {
          ...prev.activities,
          [sessionId]: { ...current, phase: 'running', lastOutputAt: now, lastStartedAt: now, source: 'output' },
        },
      };
    });
  },

  reportHookRunning: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      // blocked 可被 running Hook 解除（如 PostToolUse/AskUserQuestion）
      clearCompletedTimer(sessionId);
      return {
        activities: {
          ...prev.activities,
          [sessionId]: { ...current, phase: 'running', lastCpuActiveAt: now, lastStartedAt: now, source: 'hook' },
        },
      };
    });
  },

  reportHookBlocked: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      clearCompletedTimer(sessionId);
      return {
        activities: {
          ...prev.activities,
          [sessionId]: { ...current, phase: 'blocked', lastOutputAt: now, source: 'hook' },
        },
      };
    });
  },

  reportHookCompleted: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      clearCompletedTimer(sessionId);
      // 设置 completed + 60s TTL 自动回 idle
      const timer = setTimeout(() => {
        completedTimers.delete(sessionId);
        const currentNow = get().activities[sessionId];
        if (currentNow?.phase === 'completed') {
          set((p) => ({
            activities: { ...p.activities, [sessionId]: { ...currentNow, phase: 'idle', source: 'inferred' } },
          }));
        }
      }, COMPLETED_TTL_MS);
      completedTimers.set(sessionId, timer);
      return {
        activities: {
          ...prev.activities,
          [sessionId]: { ...current, phase: 'completed', lastCompletedAt: now, source: 'hook' },
        },
      };
    });
  },

  tickIdleCheck: (now) => {
    const { activities } = get();
    const updates: Record<string, AgentRuntimeActivity> = {};
    for (const [sessionId, activity] of Object.entries(activities)) {
      if (activity.phase !== 'running') continue;
      const elapsedSinceCpu = now - activity.lastCpuActiveAt;
      const elapsedSinceOutput = now - activity.lastOutputAt;
      // 两个都超过阈值 → 转为 completed（或 idle）
      if (elapsedSinceCpu > IDLE_THRESHOLD_MS && elapsedSinceOutput > IDLE_THRESHOLD_MS) {
        // 有过实际工作（startedAt 存在且晚于 0）→ completed
        if (activity.lastStartedAt > 0) {
          updates[sessionId] = {
            ...activity,
            phase: 'completed',
            lastCompletedAt: now,
            source: 'inferred',
          };
          // 60s TTL 自动回 idle
          clearCompletedTimer(sessionId);
          const sid = sessionId;
          const timer = setTimeout(() => {
            completedTimers.delete(sid);
            const currentNow = get().activities[sid];
            if (currentNow?.phase === 'completed') {
              set((p) => ({
                activities: { ...p.activities, [sid]: { ...currentNow, phase: 'idle', source: 'inferred' } },
              }));
            }
          }, COMPLETED_TTL_MS);
          completedTimers.set(sid, timer);
        } else {
          updates[sessionId] = { ...activity, phase: 'idle', source: 'inferred' };
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      set((prev) => ({ activities: { ...prev.activities, ...updates } }));
    }
  },

  markViewed: (sessionId) => {
    set((prev) => {
      const current = prev.activities[sessionId];
      if (!current || current.phase !== 'completed') return prev;
      clearCompletedTimer(sessionId);
      return {
        activities: { ...prev.activities, [sessionId]: { ...current, phase: 'idle', source: 'manual' } },
      };
    });
  },

  clearSession: (sessionId) => {
    clearCompletedTimer(sessionId);
    set((prev) => {
      const { [sessionId]: _, ...rest } = prev.activities;
      return { activities: rest };
    });
  },

  getPhase: (sessionId) => {
    return get().activities[sessionId]?.phase ?? 'idle';
  },
}));
