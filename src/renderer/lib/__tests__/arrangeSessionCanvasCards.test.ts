import { describe, expect, it } from 'vitest';
import {
  CANVAS_CARD_DEFAULT_HEIGHT,
  CANVAS_CARD_DEFAULT_WIDTH,
  computeArrangedPositions,
  getCardRepoPath,
  sortCardsByRepoPath,
} from '../arrangeSessionCanvasCards';
import type { CanvasCardItem } from '../../components/canvas/SessionCanvasCard';

function agentItem(repoPath: string, cwd: string, id: string): CanvasCardItem {
  return {
    kind: 'agent',
    session: {
      id,
      name: id,
      agentId: 'claude',
      agentCommand: 'claude',
      initialized: true,
      activated: true,
      repoPath,
      cwd,
    },
    outputState: 'idle',
  };
}

describe('arrangeSessionCanvasCards', () => {
  it('sorts by repo path case-insensitively', () => {
    const items = [
      agentItem('Z:/repo', 'Z:/repo/wt', 'z'),
      agentItem('A:/repo', 'A:/repo/wt', 'a'),
      agentItem('M:/repo', 'M:/repo/wt', 'm'),
    ];
    const sorted = sortCardsByRepoPath(items);
    expect(sorted.map((i) => getCardRepoPath(i))).toEqual(['A:/repo', 'M:/repo', 'Z:/repo']);
  });

  it('lays out a grid with default card size', () => {
    const items = [
      agentItem('B:/r', 'B:/r/w', 'b'),
      agentItem('A:/r', 'A:/r/w', 'a'),
    ];
    const positions = computeArrangedPositions(items, 800);
    expect(positions['agent-a']).toEqual({ x: 16, y: 16 });
    expect(positions['agent-b']).toEqual({
      x: 16 + CANVAS_CARD_DEFAULT_WIDTH + 12,
      y: 16,
    });
    expect(CANVAS_CARD_DEFAULT_WIDTH).toBe(320);
    expect(CANVAS_CARD_DEFAULT_HEIGHT).toBe(300);
  });
});
