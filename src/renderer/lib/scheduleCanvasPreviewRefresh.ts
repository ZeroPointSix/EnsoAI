import { refreshAllCanvasPreviews } from '@/lib/refreshCanvasPreviews';

/** 看板打开时多次拉取 xterm/缓存预览，缓解启动瞬间空白 */
export function scheduleCanvasPreviewRefresh(): () => void {
  refreshAllCanvasPreviews();
  const delays = [250, 800, 2000, 5000];
  const timers = delays.map((ms) => setTimeout(() => refreshAllCanvasPreviews(), ms));
  return () => {
    for (const timer of timers) {
      clearTimeout(timer);
    }
  };
}
