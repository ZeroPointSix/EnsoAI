import type { SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { buildSessionCanvasSnapshot } from '@/lib/buildSessionCanvasSnapshot';

/** 推送当前 runtime + 缓存解析后的快照；不在此处做 xterm 刷新，避免启动屏覆盖 PTY 流。 */
export function pushSessionCanvasSnapshotToPanel(): void {
  const snapshot: SessionCanvasSnapshot = buildSessionCanvasSnapshot();
  window.electronAPI.sessionCanvasPanel.sendSync(snapshot);
}
