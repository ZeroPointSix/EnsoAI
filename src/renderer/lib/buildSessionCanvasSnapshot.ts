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
import { useCanvasCardDisplayStore } from '@/stores/canvasCardDisplayStore';
import {
  type AgentRuntimeActivity,
  type AgentRuntimePhase,
  useAgentRuntimeActivityStore,
} from '@/stores/agentRuntimeActivity';
import { resolveSessionPtyId } from '@/stores/sessionPtyRegistry';
import { useTerminalStore } from '@/stores/terminal';

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

/** 快照用 Agent 四色状态：Hook blocked > runtime activity > 旧 outputState 回退 */
export function resolveAgentDisplayStateForSnapshot(input: {
  activity?: AgentRuntimeActivity;
  hookState?: SessionCanvasAgentDisplayState;
  outputState: OutputState;
  previewText?: string;
}): SessionCanvasAgentDisplayState {
  if (input.hookState === 'blocked') {
    return 'blocked';
  }
  if (input.activity) {
    return runtimePhaseToAgentDisplayState(input.activity.phase);
  }
  return resolveCanvasAgentDisplayState({
    outputState: input.outputState,
    previewText: input.previewText,
    hookState: input.hookState,
  });
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
  const agentDisplayState = resolveAgentDisplayStateForSnapshot({
    activity,
    hookState,
    outputState,
    previewText,
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
    agentDisplayState,
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

  return { cards };
}
