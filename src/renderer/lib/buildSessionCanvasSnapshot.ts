import type {
  SessionCanvasAgentDisplayState,
  SessionCanvasCardSnapshot,
  SessionCanvasSnapshot,
} from '@shared/types/sessionCanvas';
import type { Session } from '@/components/chat/SessionBar';
import type { OutputState } from '@/stores/agentSessions';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { getResolvedSessionPreview } from '@/stores/sessionPreviewCache';
import type { TerminalSessionEntry } from '@/stores/terminal';
import { resolveCanvasAgentDisplayState } from '@/lib/canvasAgentState/resolveCanvasAgentDisplayState';
import {
  inferBlockedFromPreview,
  inferPreviewSignalReason,
} from '@/lib/canvasAgentState/inferDisplayFromPreview';
import { useCanvasCardDisplayStore } from '@/stores/canvasCardDisplayStore';
import {
  type AgentRuntimeActivity,
  type AgentRuntimePhase,
  useAgentRuntimeActivityStore,
} from '@/stores/agentRuntimeActivity';
import { resolveSessionPtyId } from '@/stores/sessionPtyRegistry';
import { useTerminalStore } from '@/stores/terminal';
import { sessionCanvasLog, shortSessionId } from '@/lib/sessionCanvasLog';

function mapOutputState(state: OutputState | undefined): SessionCanvasCardSnapshot['outputState'] {
  if (state === 'outputting' || state === 'unread') return state;
  return 'idle';
}

function runtimePhaseToAgentDisplayState(
  phase: AgentRuntimePhase
): SessionCanvasAgentDisplayState {
  switch (phase) {
    case 'running':
      return 'working';
    case 'blocked':
      return 'blocked';
    case 'completed':
      return 'completed';
    default:
      return 'idle';
  }
}

export type SnapshotDisplayResolveBranch =
  | 'hookBlocked'
  | 'previewBlocked'
  | 'activity'
  | 'fallback';

/** 快照用 Agent 四色状态：Hook blocked > runtime activity > 旧 outputState 回退 */
export function resolveAgentDisplayStateForSnapshot(input: {
  activity?: AgentRuntimeActivity;
  hookState?: SessionCanvasAgentDisplayState;
  outputState: OutputState;
  previewText?: string;
  previewRawTail?: string;
}): SessionCanvasAgentDisplayState {
  return resolveAgentDisplayStateWithBranch(input).state;
}

export function resolveAgentDisplayStateWithBranch(input: {
  activity?: AgentRuntimeActivity;
  hookState?: SessionCanvasAgentDisplayState;
  outputState: OutputState;
  previewText?: string;
  previewRawTail?: string;
}): { state: SessionCanvasAgentDisplayState; branch: SnapshotDisplayResolveBranch; activityPhase?: AgentRuntimePhase } {
  if (input.hookState === 'blocked' || input.activity?.phase === 'blocked') {
    return { state: 'blocked', branch: 'hookBlocked', activityPhase: input.activity?.phase };
  }
  const previewSignal = inferPreviewSignalReason(input.previewText, input.previewRawTail);
  if (previewSignal.kind !== 'none') {
    return {
      state: 'blocked',
      branch: 'previewBlocked',
      activityPhase: input.activity?.phase,
    };
  }
  if (input.activity) {
    return {
      state: runtimePhaseToAgentDisplayState(input.activity.phase),
      branch: 'activity',
      activityPhase: input.activity.phase,
    };
  }
  return {
    state: resolveCanvasAgentDisplayState({
      outputState: input.outputState,
      previewText: input.previewText,
      hookState: input.hookState,
    }),
    branch: 'fallback',
  };
}

function agentCard(session: Session, outputState: OutputState): SessionCanvasCardSnapshot {
  const runtime = useAgentSessionsStore.getState().runtimeStates[session.id];
  const previewText = getResolvedSessionPreview(
    'agent',
    session.id,
    runtime?.previewText,
    runtime?.previewEscapePending
  );
  const hookState = useCanvasCardDisplayStore.getState().bySessionId[session.id];
  const activity = useAgentRuntimeActivityStore.getState().activities[session.id];
  const previewRawTail = runtime?.previewRawTail;
  const previewSignal = inferPreviewSignalReason(previewText, previewRawTail);
  const resolved = resolveAgentDisplayStateWithBranch({
    activity,
    hookState,
    outputState,
    previewText,
    previewRawTail,
  });

  sessionCanvasLog('Snapshot', 'agent card display', {
    sessionId: shortSessionId(session.id),
    branch: resolved.branch,
    agentDisplayState: resolved.state,
    activityPhase: resolved.activityPhase,
    activityCpuWakeArmed: activity?.cpuWakeArmed,
    activityPreviewBlock: activity?.previewBlockReason,
    hookState: hookState ?? 'none',
    outputState,
    previewSignal: previewSignal.reason,
    previewFlags: previewSignal.flags,
    previewTail: previewText?.slice(-80),
    rawHasAnsi: Boolean(previewRawTail?.includes('\u001b')),
  });

  return {
    key: `agent-${session.id}`,
    kind: 'agent',
    sessionId: session.id,
    ptyId: resolveSessionPtyId(session.id),
    repoPath: session.repoPath,
    cwd: session.cwd,
    title: session.userRenamed
      ? session.name
      : session.terminalTitle || session.name,
    userRenamed: session.userRenamed,
    agentId: session.agentId,
    agentCommand: session.agentCommand,
    customPath: session.customPath,
    previewText,
    outputState: mapOutputState(outputState),
    agentDisplayState: resolved.state,
  };
}

function terminalCard(session: TerminalSessionEntry): SessionCanvasCardSnapshot {
  return {
    key: `terminal-${session.id}`,
    kind: 'terminal',
    sessionId: session.id,
    ptyId: resolveSessionPtyId(session.id),
    repoPath: session.cwd,
    cwd: session.cwd,
    title: session.title || 'Terminal',
    previewText: getResolvedSessionPreview(
      'terminal',
      session.id,
      session.previewText,
      session.previewEscapePending
    ),
  };
}

export function buildSessionCanvasSnapshot(): SessionCanvasSnapshot {
  const { sessions, runtimeStates } = useAgentSessionsStore.getState();
  const terminalSessions = useTerminalStore.getState().sessions;

  const cards: SessionCanvasCardSnapshot[] = [
    ...sessions.map((s) => agentCard(s, runtimeStates[s.id]?.outputState ?? 'idle')),
    ...terminalSessions.map(terminalCard),
  ];

  const agentLights = cards
    .filter((c) => c.kind === 'agent')
    .map((c) => ({
      sessionId: shortSessionId(c.sessionId),
      light: c.agentDisplayState,
      outputState: c.outputState,
    }));

  sessionCanvasLog('Snapshot', 'build complete', {
    agentCount: sessions.length,
    terminalCount: terminalSessions.length,
    agentLights,
  });

  return { cards };
}
