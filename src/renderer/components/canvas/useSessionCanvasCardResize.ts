import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasCardItem } from './SessionCanvasCard';
import { sessionCanvasLog } from '@/lib/sessionCanvasLog';
import { useSettingsStore } from '@/stores/settings';

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 960;
const MAX_HEIGHT = 720;

export { getSessionCanvasCardKey } from '@/lib/sessionCanvasCardKey';

export function useSessionCanvasCardResize(
  cardKey: string,
  sizeOverride?: { width: number; height: number }
) {
  const saved = useSettingsStore((s) => s.sessionCanvasCardSizes[cardKey]);
  const setCardSize = useSettingsStore((s) => s.setSessionCanvasCardSize);

  const width = sizeOverride?.width ?? saved?.width ?? DEFAULT_WIDTH;
  const height = sizeOverride?.height ?? saved?.height ?? DEFAULT_HEIGHT;

  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef({ x: 0, y: 0, width, height });

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (sizeOverride) return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      sessionCanvasLog('Resize', 'resize start', { cardKey, width, height });
      resizeStart.current = { x: e.clientX, y: e.clientY, width, height };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [sizeOverride, width, height]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: PointerEvent) => {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      const nextWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, resizeStart.current.width + deltaX)
      );
      const nextHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, resizeStart.current.height + deltaY)
      );
      setCardSize(cardKey, { width: nextWidth, height: nextHeight });
    };

    const handleUp = () => {
      const saved = useSettingsStore.getState().sessionCanvasCardSizes[cardKey];
      sessionCanvasLog('Resize', 'resize end', { cardKey, size: saved });
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isResizing, cardKey, setCardSize]);

  return {
    width,
    height,
    isResizing,
    handleResizePointerDown,
  };
}
