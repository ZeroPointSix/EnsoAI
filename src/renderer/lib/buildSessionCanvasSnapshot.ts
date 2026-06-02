import type {
  SessionCanvasCardSnapshot,
  SessionCanvasSnapshot,
} from '@shared/types/sessionCanvas';
import type { Session } from '@/components/chat/SessionBar';
import type { OutputState } from '@/stores/agentSessions';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { getResolvedSessionPreview } from '@/stores/sessionPreviewCache';
import type { TerminalSessionEntry } from '@/stores/terminal';
import { useTerminalStore } from '@/stores/terminal';

function mapOutputState(state: OutputState | undefined): SessionCanvasCardSnapshot['outputState'] {
  if (state === 'outputting' || state === 'unread') return state;
  return 'idle';
}

function agentCard(session: Session, outputState: OutputState): SessionCanvasCardSnapshot {
  const runtime = useAgentSessionsStore.getState().runtimeStates[session.id];
  return {
    key: `agent-${session.id}`,
    kind: 'agent',
    sessionId: session.id,
    repoPath: session.repoPath,
    cwd: session.cwd,
    title: session.userRenamed
      ? session.name
      : session.terminalTitle || session.name,
    userRenamed: session.userRenamed,
    previewText: getResolvedSessionPreview(
      'agent',
      session.id,
      runtime?.previewText,
      runtime?.previewEscapePending
    ),
    outputState: mapOutputState(outputState),
  };
}

function terminalCard(session: TerminalSessionEntry): SessionCanvasCardSnapshot {
  return {
    key: `terminal-${session.id}`,
    kind: 'terminal',
    sessionId: session.id,
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
