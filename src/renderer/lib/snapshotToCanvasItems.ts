import type { SessionCanvasCardSnapshot } from '@shared/types/sessionCanvas';
import type { Session } from '@/components/chat/SessionBar';
import type { CanvasCardItem } from '@/components/canvas/SessionCanvasCard';
import type { OutputState } from '@/stores/agentSessions';
import type { TerminalSessionEntry } from '@/stores/terminal';

function toOutputState(state: SessionCanvasCardSnapshot['outputState']): OutputState {
  if (state === 'outputting' || state === 'unread') return state;
  return 'idle';
}

export function snapshotCardsToCanvasItems(cards: SessionCanvasCardSnapshot[]): CanvasCardItem[] {
  return cards.map((card) => {
    if (card.kind === 'agent') {
      const session: Session = {
        id: card.sessionId,
        sessionId: card.sessionId,
        name: card.title,
        agentId: 'claude',
        agentCommand: 'claude',
        initialized: true,
        activated: true,
        repoPath: card.repoPath,
        cwd: card.cwd,
        terminalTitle: card.title,
      };
      return {
        kind: 'agent',
        session,
        previewText: card.previewText,
        outputState: toOutputState(card.outputState),
      };
    }

    const session: TerminalSessionEntry = {
      id: card.sessionId,
      cwd: card.cwd,
      title: card.title,
      previewText: card.previewText,
    };

    return {
      kind: 'terminal',
      session,
      previewText: card.previewText,
    };
  });
}
