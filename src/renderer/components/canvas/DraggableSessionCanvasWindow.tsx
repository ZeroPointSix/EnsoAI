import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TabId } from '@/App/constants';
import { useI18n } from '@/i18n';
import { scaleInVariants, springFast } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useSettingsStore } from '@/stores/settings';
import { useTerminalStore } from '@/stores/terminal';
import { SessionCanvasPanel } from './SessionCanvasPanel';

interface DraggableSessionCanvasWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWorktreeByPath: (worktreePath: string) => Promise<void> | void;
  onSwitchTab?: (tab: TabId) => void;
}

const DEFAULT_WIDTH = 920;
const DEFAULT_HEIGHT = 680;
const MIN_WIDTH = 560;
const MIN_HEIGHT = 400;

export function DraggableSessionCanvasWindow({
  open,
  onOpenChange,
  onSelectWorktreeByPath,
  onSwitchTab,
}: DraggableSessionCanvasWindowProps) {
  const { t } = useI18n();
  const savedBounds = useSettingsStore((s) => s.sessionCanvasModalBounds);
  const legacyPosition = useSettingsStore((s) => s.sessionCanvasModalPosition);
  const setSessionCanvasModalBounds = useSettingsStore((s) => s.setSessionCanvasModalBounds);

  const agentCount = useAgentSessionsStore((s) => s.sessions.length);
  const terminalCount = useTerminalStore((s) => s.sessions.length);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [bounds, setBounds] = useState({
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const dragStartPos = useRef<{ x: number; y: number; lastX?: number; lastY?: number }>({
    x: 0,
    y: 0,
  });
  const resizeStartPos = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    lastWidth?: number;
    lastHeight?: number;
  }>({ x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const windowRef = useRef<HTMLDivElement>(null);

  const isMac = window.electronAPI.env.platform === 'darwin';
  const MAC_SAFE_MARGIN_Y = 50;

  const persistBounds = useCallback(
    (next: typeof bounds) => {
      setSessionCanvasModalBounds(next);
    },
    [setSessionCanvasModalBounds]
  );

  useEffect(() => {
    if (!open) return;

    const minX = 0;
    const minY = isMac ? MAC_SAFE_MARGIN_Y : 0;
    const maxWidth = Math.min(DEFAULT_WIDTH + 400, window.innerWidth - 24);
    const maxHeight = Math.min(DEFAULT_HEIGHT + 200, window.innerHeight - minY - 24);

    const width = Math.min(
      maxWidth,
      Math.max(MIN_WIDTH, savedBounds?.width ?? DEFAULT_WIDTH)
    );
    const height = Math.min(
      maxHeight,
      Math.max(MIN_HEIGHT, savedBounds?.height ?? DEFAULT_HEIGHT)
    );
    const centerX = Math.max(minX, (window.innerWidth - width) / 2);
    const centerY = Math.max(minY, (window.innerHeight - height) / 2);

    const x = savedBounds?.x ?? legacyPosition?.x ?? centerX;
    const y = savedBounds?.y ?? legacyPosition?.y ?? centerY;

    const clamped = {
      x: Math.max(minX, Math.min(x, window.innerWidth - width)),
      y: Math.max(minY, Math.min(y, window.innerHeight - height)),
      width,
      height,
    };

    setBounds(clamped);
    if (!savedBounds) {
      persistBounds(clamped);
    }
  }, [open, savedBounds, legacyPosition, persistBounds, isMac]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.no-drag')) return;
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - bounds.x,
        y: e.clientY - bounds.y,
      };
    },
    [bounds.x, bounds.y]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: bounds.width,
        height: bounds.height,
      };
    },
    [bounds.width, bounds.height]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const minY = isMac ? MAC_SAFE_MARGIN_Y : 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        let newX = e.clientX - dragStartPos.current.x;
        let newY = e.clientY - dragStartPos.current.y;
        newX = Math.max(0, Math.min(newX, window.innerWidth - bounds.width));
        newY = Math.max(minY, Math.min(newY, window.innerHeight - bounds.height));

        if (windowRef.current) {
          windowRef.current.style.left = `${newX}px`;
          windowRef.current.style.top = `${newY}px`;
        }
        dragStartPos.current.lastX = newX;
        dragStartPos.current.lastY = newY;
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;
        const maxW = window.innerWidth - bounds.x - 8;
        const maxH = window.innerHeight - bounds.y - 8;
        const newWidth = Math.min(maxW, Math.max(MIN_WIDTH, resizeStartPos.current.width + deltaX));
        const newHeight = Math.min(
          maxH,
          Math.max(MIN_HEIGHT, resizeStartPos.current.height + deltaY)
        );

        if (windowRef.current) {
          windowRef.current.style.width = `${newWidth}px`;
          windowRef.current.style.height = `${newHeight}px`;
        }
        resizeStartPos.current.lastWidth = newWidth;
        resizeStartPos.current.lastHeight = newHeight;
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        const finalX = dragStartPos.current.lastX ?? bounds.x;
        const finalY = dragStartPos.current.lastY ?? bounds.y;
        const next = { ...bounds, x: finalX, y: finalY };
        setBounds(next);
        persistBounds(next);
      }
      if (isResizing) {
        setIsResizing(false);
        const finalWidth = resizeStartPos.current.lastWidth ?? bounds.width;
        const finalHeight = resizeStartPos.current.lastHeight ?? bounds.height;
        const next = { ...bounds, width: finalWidth, height: finalHeight };
        setBounds(next);
        persistBounds(next);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, isMac, bounds, persistBounds]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={windowRef}
          variants={scaleInVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={isDragging || isResizing ? { duration: 0 } : springFast}
          className="fixed flex flex-col rounded-2xl border bg-popover shadow-lg"
          style={
            {
              left: `${bounds.x}px`,
              top: `${bounds.y}px`,
              width: `${bounds.width}px`,
              height: `${bounds.height}px`,
              zIndex: Z_INDEX.SESSION_CANVAS_WINDOW,
              WebkitAppRegion: 'no-drag',
            } as React.CSSProperties
          }
          role="dialog"
          aria-modal="false"
          aria-label={t('Session Canvas')}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-between border-b px-4 py-3 select-none rounded-t-2xl',
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="min-w-0 pr-4">
              <h2 className="text-lg font-medium">{t('Session Canvas')}</h2>
              <p className="text-xs text-muted-foreground">
                {t('{{agents}} agents · {{terminals}} terminals', {
                  agents: agentCount,
                  terminals: terminalCount,
                })}
                <span className="mx-1.5 text-border">·</span>
                <span className="text-muted-foreground/80">{t('Session Canvas (Ctrl+5)')}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="no-drag flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              title={t('Close')}
              aria-label={t('Close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <SessionCanvasPanel
              variant="floating"
              isActive
              syncPreviews
              onSelectWorktreeByPath={onSelectWorktreeByPath}
              onSwitchTab={onSwitchTab}
            />
          </div>

          <button
            type="button"
            aria-label={t('Resize')}
            className="no-drag absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize rounded-br-2xl"
            onMouseDown={handleResizeMouseDown}
          >
            <span className="absolute bottom-1 right-1 block h-2 w-2 border-r-2 border-b-2 border-muted-foreground/60" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
