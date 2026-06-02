import type { CanvasCardItem } from '../components/canvas/SessionCanvasCard';
import { getSessionCanvasCardKey } from './sessionCanvasCardKey';

export const CANVAS_CARD_DEFAULT_WIDTH = 320;
export const CANVAS_CARD_DEFAULT_HEIGHT = 300;
export const CANVAS_ARRANGE_GAP = 12;
export const CANVAS_ARRANGE_PADDING = 16;

export function getCardRepoPath(item: CanvasCardItem): string {
  return item.kind === 'agent' ? item.session.repoPath : item.session.cwd;
}

export function sortCardsByRepoPath(items: CanvasCardItem[]): CanvasCardItem[] {
  return [...items].sort((a, b) =>
    getCardRepoPath(a).localeCompare(getCardRepoPath(b), undefined, { sensitivity: 'base' })
  );
}

export function computeArrangedPositions(
  items: CanvasCardItem[],
  containerWidth: number,
  cardWidth = CANVAS_CARD_DEFAULT_WIDTH,
  cardHeight = CANVAS_CARD_DEFAULT_HEIGHT
): Record<string, { x: number; y: number }> {
  const sorted = sortCardsByRepoPath(items);
  const gap = CANVAS_ARRANGE_GAP;
  const pad = CANVAS_ARRANGE_PADDING;
  const innerWidth = Math.max(cardWidth, containerWidth - pad * 2);
  const cols = Math.max(1, Math.floor((innerWidth + gap) / (cardWidth + gap)));

  const positions: Record<string, { x: number; y: number }> = {};
  sorted.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions[getSessionCanvasCardKey(item)] = {
      x: pad + col * (cardWidth + gap),
      y: pad + row * (cardHeight + gap),
    };
  });

  return positions;
}

export function computeArrangedCanvasHeight(
  itemCount: number,
  containerWidth: number,
  cardWidth = CANVAS_CARD_DEFAULT_WIDTH,
  cardHeight = CANVAS_CARD_DEFAULT_HEIGHT
): number {
  if (itemCount === 0) return 360;
  const gap = CANVAS_ARRANGE_GAP;
  const pad = CANVAS_ARRANGE_PADDING;
  const innerWidth = Math.max(cardWidth, containerWidth - pad * 2);
  const cols = Math.max(1, Math.floor((innerWidth + gap) / (cardWidth + gap)));
  const rows = Math.ceil(itemCount / cols);
  return pad + rows * (cardHeight + gap) + pad;
}
