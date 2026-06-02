import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settings';

const GRID_GAP = 12;
const DEFAULT_CARD_WIDTH = 320;
const DEFAULT_CARD_HEIGHT = 300;

export function getDefaultCardPosition(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 16 + col * (DEFAULT_CARD_WIDTH + GRID_GAP),
    y: 16 + row * (DEFAULT_CARD_HEIGHT + GRID_GAP),
  };
}

export function useSessionCanvasCardDrag(cardKey: string, index: number) {
  const saved = useSettingsStore((s) => s.sessionCanvasCardPositions[cardKey]);
  const setCardPosition = useSettingsStore((s) => s.setSessionCanvasCardPosition);

  const defaultPos = getDefaultCardPosition(index);
  const position = saved ?? defaultPos;

  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: position.x, posY: position.y });

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position.x, position.y]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      setCardPosition(cardKey, {
        x: Math.max(0, dragStart.current.posX + deltaX),
        y: Math.max(0, dragStart.current.posY + deltaY),
      });
    };

    const handleUp = () => setIsDragging(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, cardKey, setCardPosition]);

  return {
    position,
    isDragging,
    handleDragPointerDown,
  };
}
