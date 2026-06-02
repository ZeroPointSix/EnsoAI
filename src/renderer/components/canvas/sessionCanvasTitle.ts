import type { CanvasCardItem } from './SessionCanvasCard';

/** Canvas card title: user rename wins, else OSC terminal title, else session name. */
export function resolveSessionCanvasCardTitle(item: CanvasCardItem, fallbackTerminal: string): string {
  if (item.kind === 'agent') {
    if (item.session.userRenamed) {
      return item.session.name;
    }
    return item.session.terminalTitle || item.session.name;
  }
  return item.session.title || fallbackTerminal;
}
