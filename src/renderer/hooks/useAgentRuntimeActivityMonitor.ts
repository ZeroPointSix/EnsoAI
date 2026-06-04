import { useEffect, useRef } from 'react';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useAgentRuntimeActivityStore } from '@/stores/agentRuntimeActivity';
import { useSessionPtyRegistry } from '@/stores/sessionPtyRegistry';
import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';
import { normalizePath } from '@shared/utils/path';
import {
  sessionCanvasLog,
  sessionCanvasLogThrottled,
  shortSessionId,
} from '@/lib/sessionCanvasLog';

/**
 * 将 Hook 传来的 Claude sessionId + cwd 解析为 Enso session.id。
 * 复用 canvasCardDisplayStore 的逻辑。
 */
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

/** 绿态下终端碎片输出（光标/进度条）不拉回黄 */
const MIN_OUTPUT_WAKE_BYTES = 32;

/**
 * 统一 Agent Runtime Activity Monitor。
 *
 * 不依赖特定 Agent 的 Hook/API，对所有 Agent 通用：
 * 1. 定时轮询 PTY 进程 CPU 活跃度 → running / idle
 * 2. 监听 terminal.onData → 输出刷新 → running
 * 3. 接收 Hook 语义事件 → running / blocked / completed（带 sessionId resolve）
 *
 * 使用方式：在看板面板挂载时调用一次。
 */
export function useAgentRuntimeActivityMonitor(enabled: boolean): void {
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sessionCanvasLog('Monitor', enabled ? 'enabled' : 'disabled');
  }, [enabled]);

  // --- 第一层：PTY CPU 活跃度轮询 ---
  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      const sessions = useAgentSessionsStore.getState().sessions;
      const ptyMap = useSessionPtyRegistry.getState().ptyBySessionId;
      const { reportCpuActive, tickIdleCheck } = useAgentRuntimeActivityStore.getState();
      const now = Date.now();

      let withPty = 0;
      let cpuActive = 0;
      let noPty = 0;

      for (const session of sessions) {
        const ptyId = ptyMap[session.id];
        if (!ptyId) {
          noPty++;
          continue;
        }
        withPty++;
        try {
          const isActive = await window.electronAPI.terminal.getActivity(ptyId);
          if (isActive) {
            cpuActive++;
            const phaseBefore = useAgentRuntimeActivityStore.getState().getPhase(session.id);
            reportCpuActive(session.id);
            const phaseAfter = useAgentRuntimeActivityStore.getState().getPhase(session.id);
            if (phaseBefore === 'completed' && phaseAfter === 'completed') {
              sessionCanvasLogThrottled(
                `monitor-cpu-hold-${session.id}`,
                5000,
                'Monitor',
                'getActivity true but phase stays completed (cpu-hold)',
                { sessionId: shortSessionId(session.id), ptyId }
              );
            }
          }
        } catch {
          sessionCanvasLogThrottled(
            `monitor-pty-error-${session.id}`,
            5000,
            'Monitor',
            'getActivity failed',
            { sessionId: shortSessionId(session.id), ptyId }
          );
        }
      }

      tickIdleCheck(now);

      const phases = useAgentRuntimeActivityStore.getState().activities;
      const phaseSummary = Object.fromEntries(
        Object.entries(phases).map(([id, a]) => [shortSessionId(id), a.phase])
      );

      sessionCanvasLogThrottled('monitor-poll-summary', 2000, 'Monitor', 'poll tick', {
        agentCount: sessions.length,
        withPty,
        noPty,
        cpuActive,
        phaseSummary,
      });
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 800);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      sessionCanvasLog('Monitor', 'poll stopped');
    };
  }, [enabled]);

  // --- 第二层：终端输出辅助信号 ---
  useEffect(() => {
    if (!enabled) return;

    const { reportOutput } = useAgentRuntimeActivityStore.getState();

    return window.electronAPI.terminal.onData(({ id, data }) => {
      if (!data) return;
      const ptyMap = useSessionPtyRegistry.getState().ptyBySessionId;
      const agentIds = new Set(useAgentSessionsStore.getState().sessions.map((s) => s.id));
      for (const [sessionId, ptyId] of Object.entries(ptyMap)) {
        if (ptyId !== id) continue;
        if (agentIds.has(sessionId)) {
          const phase = useAgentRuntimeActivityStore.getState().getPhase(sessionId);
          if (phase === 'completed' && data.length < MIN_OUTPUT_WAKE_BYTES) {
            sessionCanvasLogThrottled(
              `monitor-ondata-skip-${sessionId}`,
              3000,
              'Monitor',
              'onData skipped (completed-hold, small chunk)',
              { sessionId: shortSessionId(sessionId), bytes: data.length, minBytes: MIN_OUTPUT_WAKE_BYTES }
            );
            break;
          }
          reportOutput(sessionId);
          sessionCanvasLogThrottled(
            `monitor-ondata-${sessionId}`,
            3000,
            'Monitor',
            'terminal.onData → reportOutput',
            { sessionId: shortSessionId(sessionId), ptyId, bytes: data.length, phase }
          );
        }
        break;
      }
    });
  }, [enabled]);

  // --- 第三层：Hook 语义事件（Claude 专属增强） ---
  useEffect(() => {
    if (!enabled) return;

    const { reportHookRunning, reportHookBlocked, reportHookCompleted } =
      useAgentRuntimeActivityStore.getState();

    const unsubPre = window.electronAPI.notification.onPreToolUse((data) => {
      const sessionId = resolveEnsoSessionId(data.sessionId, data.cwd);
      if (sessionId) {
        reportHookRunning(sessionId);
        sessionCanvasLog('Monitor', 'hook PreToolUse → running', {
          sessionId: shortSessionId(sessionId),
          toolName: data.toolName,
        });
      } else {
        sessionCanvasLog('Monitor', 'hook PreToolUse resolve failed', {
          incomingSessionId: data.sessionId?.slice(0, 8),
          cwd: data.cwd,
        });
      }
    });

    const unsubAsk = window.electronAPI.notification.onAskUserQuestion((data) => {
      const sessionId = resolveEnsoSessionId(data.sessionId, data.cwd);
      if (sessionId) {
        reportHookBlocked(sessionId);
        sessionCanvasLog('Monitor', 'hook AskUserQuestion → blocked', {
          sessionId: shortSessionId(sessionId),
          cwd: data.cwd,
        });
      } else {
        sessionCanvasLog('Monitor', 'hook AskUserQuestion resolve failed', {
          incomingSessionId: data.sessionId?.slice(0, 8),
          cwd: data.cwd,
        });
      }
    });

    const unsubStop = window.electronAPI.notification.onAgentStop((data) => {
      const sessionId = resolveEnsoSessionId(data.sessionId, data.cwd);
      if (sessionId) {
        reportHookCompleted(sessionId);
        sessionCanvasLog('Monitor', 'hook Stop → completed', {
          sessionId: shortSessionId(sessionId),
        });
      } else {
        sessionCanvasLog('Monitor', 'hook Stop resolve failed', {
          incomingSessionId: data.sessionId?.slice(0, 8),
          cwd: data.cwd,
        });
      }
    });

    sessionCanvasLog('Monitor', 'hook listeners registered');

    return () => {
      unsubPre();
      unsubAsk();
      unsubStop();
      sessionCanvasLog('Monitor', 'hook listeners removed');
    };
  }, [enabled]);
}

/**
 * 从 runtime activity store 读取 session 的 phase，映射为看板四色状态。
 * 供 SessionCanvasCard 使用。
 */
export function useSessionRuntimePhase(sessionId: string, isAgent: boolean): CanvasAgentDisplayState {
  return useAgentRuntimeActivityStore((s) => {
    if (!isAgent) return 'idle';
    const activity = s.activities[sessionId];
    if (!activity) return 'idle';
    switch (activity.phase) {
      case 'running':
        return 'working';
      case 'blocked':
        return 'blocked';
      case 'completed':
        return 'completed';
      default:
        return 'idle';
    }
  });
}
