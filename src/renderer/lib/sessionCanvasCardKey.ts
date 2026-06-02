import type { CanvasCardItem } from '../components/canvas/SessionCanvasCard';

export function getSessionCanvasCardKey(item: CanvasCardItem): string {
  return `${item.kind}-${item.session.id}`;
}
