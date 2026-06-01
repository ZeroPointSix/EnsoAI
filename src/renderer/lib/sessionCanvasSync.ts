import type { SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { buildSessionCanvasSnapshot } from '@/lib/buildSessionCanvasSnapshot';
import { refreshAllCanvasPreviews } from '@/lib/refreshCanvasPreviews';

export function pushSessionCanvasSnapshotToPanel(): void {
  refreshAllCanvasPreviews();
  const snapshot: SessionCanvasSnapshot = buildSessionCanvasSnapshot();
  window.electronAPI.sessionCanvasPanel.sendSync(snapshot);
}
