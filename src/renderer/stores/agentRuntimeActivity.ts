import { create } from 'zustand';
import { sessionCanvasLog, sessionCanvasLogPhase } from '@/lib/sessionCanvasLog';

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

/** CPU/输出空闲判定：无活跃信号超过该时长 → completed（看板黄→绿） */
const IDLE_THRESHOLD_MS = 5_000;

/** 绿态后短时 CPU 抖动不再立刻拉回黄（避免黄绿闪烁） */
const COMPLETED_REARM_MS = 4_000;

function isOutputIdle(activity: AgentRuntimeActivity, now: number): boolean {
  if (activity.lastOutputAt <= 0) {
    return true;
  }
  return now - activity.lastOutputAt > IDLE_THRESHOLD_MS;
}

function promoteCompletedToRunning(
  sessionId: string,
  current: AgentRuntimeActivity,
  now: number,
  source: ActivitySource
): AgentRuntimeActivity {
  clearCompletedTimer(sessionId);
  return {
    ...current,
    phase: 'running',
    lastCpuActiveAt: now,
    lastOutputAt: source === 'output' ? now : current.lastOutputAt,
    lastStartedAt: now,
    source,
  };
}

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

function logPhaseIfChanged(
  sessionId: string,
  from: AgentRuntimePhase,
  to: AgentRuntimePhase,
  reason: string,
  extra?: Record<string, unknown>
): void {
  if (from === to) return;
  sessionCanvasLogPhase('Activity', sessionId, from, to, reason, extra);
}

export const useAgentRuntimeActivityStore = create<AgentRuntimeActivityState>((set, get) => ({
  activities: {},

  reportCpuActive: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      if (current.phase === 'blocked') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastCpuActiveAt: now } } };
      }
      if (current.phase === 'completed') {
        if (current.lastCompletedAt > 0 && now - current.lastCompletedAt < COMPLETED_REARM_MS) {
          return {
            activities: {
              ...prev.activities,
              [sessionId]: { ...current, lastCpuActiveAt: now },
            },
          };
        }
        const next = promoteCompletedToRunning(sessionId, current, now, 'pty');
        logPhaseIfChanged(sessionId, 'completed', 'running', 'cpu');
        return { activities: { ...prev.activities, [sessionId]: next } };
      }
      if (current.phase === 'running') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastCpuActiveAt: now } } };
      }
      const next: AgentRuntimeActivity = {
        ...current,
        phase: 'running',
        lastCpuActiveAt: now,
        lastStartedAt: now,
        source: 'pty',
      };
      logPhaseIfChanged(sessionId, current.phase, 'running', 'cpu');
      return { activities: { ...prev.activities, [sessionId]: next } };
    });
  },

  reportOutput: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      if (current.phase === 'blocked') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastOutputAt: now } } };
      }
      if (current.phase === 'completed') {
        const next = promoteCompletedToRunning(sessionId, current, now, 'output');
        logPhaseIfChanged(sessionId, 'completed', 'running', 'output');
        return { activities: { ...prev.activities, [sessionId]: next } };
      }
      if (current.phase === 'running') {
        return { activities: { ...prev.activities, [sessionId]: { ...current, lastOutputAt: now } } };
      }
      const next: AgentRuntimeActivity = {
        ...current,
        phase: 'running',
        lastOutputAt: now,
        lastStartedAt: now,
        source: 'output',
      };
      logPhaseIfChanged(sessionId, current.phase, 'running', 'output');
      return { activities: { ...prev.activities, [sessionId]: next } };
    });
  },

  reportHookRunning: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      if (current.phase === 'blocked') {
        return prev;
      }
      clearCompletedTimer(sessionId);
      const next: AgentRuntimeActivity = {
        ...current,
        phase: 'running',
        lastCpuActiveAt: now,
        lastStartedAt: now,
        source: 'hook',
      };
      logPhaseIfChanged(sessionId, current.phase, 'running', 'hook:PreToolUse');
      return { activities: { ...prev.activities, [sessionId]: next } };
    });
  },

  reportHookBlocked: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      clearCompletedTimer(sessionId);
      const next: AgentRuntimeActivity = {
        ...current,
        phase: 'blocked',
        lastOutputAt: now,
        source: 'hook',
      };
      logPhaseIfChanged(sessionId, current.phase, 'blocked', 'hook:AskUserQuestion');
      return { activities: { ...prev.activities, [sessionId]: next } };
    });
  },

  reportHookCompleted: (sessionId) => {
    const now = Date.now();
    set((prev) => {
      const current = prev.activities[sessionId] ?? defaultActivity();
      clearCompletedTimer(sessionId);
      const timer = setTimeout(() => {
        completedTimers.delete(sessionId);
        const currentNow = get().activities[sessionId];
        if (currentNow?.phase === 'completed') {
          logPhaseIfChanged(sessionId, 'completed', 'idle', 'completed TTL 60s');
          set((p) => ({
            activities: { ...p.activities, [sessionId]: { ...currentNow, phase: 'idle', source: 'inferred' } },
          }));
        }
      }, COMPLETED_TTL_MS);
      completedTimers.set(sessionId, timer);
      const next: AgentRuntimeActivity = {
        ...current,
        phase: 'completed',
        lastCompletedAt: now,
        source: 'hook',
      };
      logPhaseIfChanged(sessionId, current.phase, 'completed', 'hook:Stop');
      return { activities: { ...prev.activities, [sessionId]: next } };
    });
  },

  tickIdleCheck: (now) => {
    const { activities } = get();
    const updates: Record<string, AgentRuntimeActivity> = {};
    for (const [sessionId, activity] of Object.entries(activities)) {
      if (activity.phase !== 'running') continue;
      const elapsedSinceCpu = now - activity.lastCpuActiveAt;
      const outputIdle = isOutputIdle(activity, now);
      if (elapsedSinceCpu > IDLE_THRESHOLD_MS && outputIdle) {
        if (activity.lastStartedAt > 0) {
          updates[sessionId] = {
            ...activity,
            phase: 'completed',
            lastCompletedAt: now,
            source: 'inferred',
          };
          logPhaseIfChanged(sessionId, 'running', 'completed', 'tickIdleCheck', {
            elapsedSinceCpu,
            idleThresholdMs: IDLE_THRESHOLD_MS,
          });
          clearCompletedTimer(sessionId);
          const sid = sessionId;
          const timer = setTimeout(() => {
            completedTimers.delete(sid);
            const currentNow = get().activities[sid];
            if (currentNow?.phase === 'completed') {
              logPhaseIfChanged(sid, 'completed', 'idle', 'completed TTL 60s');
              set((p) => ({
                activities: { ...p.activities, [sid]: { ...currentNow, phase: 'idle', source: 'inferred' } },
              }));
            }
          }, COMPLETED_TTL_MS);
          completedTimers.set(sid, timer);
        } else {
          updates[sessionId] = { ...activity, phase: 'idle', source: 'inferred' };
          logPhaseIfChanged(sessionId, 'running', 'idle', 'tickIdleCheck:noStartedAt');
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
      logPhaseIfChanged(sessionId, 'completed', 'idle', 'markViewed');
      return {
        activities: { ...prev.activities, [sessionId]: { ...current, phase: 'idle', source: 'manual' } },
      };
    });
  },

  clearSession: (sessionId) => {
    clearCompletedTimer(sessionId);
    const phase = get().activities[sessionId]?.phase;
    if (phase) {
      sessionCanvasLog('Activity', 'clearSession', { sessionId: sessionId.slice(0, 8), phase });
    }
    set((prev) => {
      const { [sessionId]: _, ...rest } = prev.activities;
      return { activities: rest };
    });
  },

  getPhase: (sessionId) => {
    return get().activities[sessionId]?.phase ?? 'idle';
  },
}));
