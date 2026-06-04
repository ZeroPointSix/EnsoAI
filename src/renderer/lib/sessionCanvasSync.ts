import type { SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { buildSessionCanvasSnapshot } from '@/lib/buildSessionCanvasSnapshot';
import { refreshAllCanvasPreviews } from '@/lib/refreshCanvasPreviews';

/** 先从 xterm 刷新预览再推送（已挂载终端以屏幕为准，对齐 OpenCove presentationSnapshot）。 */
export function pushSessionCanvasSnapshotToPanel(): void {
  refreshAllCanvasPreviews();
  const snapshot: SessionCanvasSnapshot = buildSessionCanvasSnapshot();
  window.electronAPI.sessionCanvasPanel.sendSync(snapshot);
}
