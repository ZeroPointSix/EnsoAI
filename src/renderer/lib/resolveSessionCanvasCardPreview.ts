import { resolveCanvasCardPreviewText } from '@/lib/canvasPreviewQuality';

/** 独立看板仅信任主窗 IPC 快照；主窗内嵌看板才合并本地 runtime 预览。 */
export function resolveSessionCanvasCardPreviewText(
  snapshotPreview: string | undefined,
  livePreview: string | undefined,
  useLiveRuntime: boolean
): string | undefined {
  const fromSnapshot = resolveCanvasCardPreviewText(snapshotPreview);
  if (!useLiveRuntime) return fromSnapshot;
  return livePreview ?? fromSnapshot;
}
