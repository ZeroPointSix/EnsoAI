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

const WINDOW_WIDTH = 920;
const WINDOW_HEIGHT = 680;

export function DraggableSessionCanvasWindow({
  open,
  onOpenChange,
  onSelectWorktreeByPath,
  onSwitchTab,
}: DraggableSessionCanvasWindowProps) {
  const { t } = useI18n();
  const savedPosition = useSettingsStore((s) => s.sessionCanvasModalPosition);
  const setSessionCanvasModalPosition = useSettingsStore((s) => s.setSessionCanvasModalPosition);

  const agentCount = useAgentSessionsStore((s) => s.sessions.length);
  const terminalCount = useTerminalStore((s) => s.sessions.length);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(savedPosition || { x: 0, y: 0 });
  const dragStartPos = useRef<{ x: number; y: number; lastX?: number; lastY?: number }>({
    x: 0,
    y: 0,
  });
  const windowRef = useRef<HTMLDivElement>(null);

  const isMac = window.electronAPI.env.platform === 'darwin';
  const MAC_SAFE_MARGIN_Y = 50;

  useEffect(() => {
    if (!open) return;

    const minX = 0;
    const minY = isMac ? MAC_SAFE_MARGIN_Y : 0;
    const height = Math.min(WINDOW_HEIGHT, window.innerHeight - minY - 24);
    const centerX = Math.max(minX, (window.innerWidth - WINDOW_WIDTH) / 2);
    const centerY = Math.max(minY, (window.innerHeight - height) / 2);

    if (!savedPosition) {
      setPosition({ x: centerX, y: centerY });
    } else {
      const isOutOfBounds =
        savedPosition.x < minX ||
        savedPosition.y < minY ||
        savedPosition.x + WINDOW_WIDTH > window.innerWidth ||
        savedPosition.y + height > window.innerHeight;

      if (isOutOfBounds) {
        setPosition({ x: centerX, y: centerY });
        setSessionCanvasModalPosition({ x: centerX, y: centerY });
      } else {
        setPosition(savedPosition);
      }
    }
  }, [open, savedPosition, setSessionCanvasModalPosition, isMac]);

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
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const minY = isMac ? MAC_SAFE_MARGIN_Y : 0;
    const height = Math.min(WINDOW_HEIGHT, window.innerHeight - minY - 24);

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragStartPos.current.x;
      let newY = e.clientY - dragStartPos.current.y;
      newX = Math.max(0, Math.min(newX, window.innerWidth - WINDOW_WIDTH));
      newY = Math.max(minY, Math.min(newY, window.innerHeight - height));

      if (windowRef.current) {
        windowRef.current.style.left = `${newX}px`;
        windowRef.current.style.top = `${newY}px`;
      }
      dragStartPos.current.lastX = newX;
      dragStartPos.current.lastY = newY;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const finalX = dragStartPos.current.lastX ?? position.x;
      const finalY = dragStartPos.current.lastY ?? position.y;
      setPosition({ x: finalX, y: finalY });
      setSessionCanvasModalPosition({ x: finalX, y: finalY });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMac, position.x, position.y, setSessionCanvasModalPosition]);

  if (!open) return null;

  const panelHeight = Math.min(WINDOW_HEIGHT, window.innerHeight - (isMac ? MAC_SAFE_MARGIN_Y : 0) - 24);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={windowRef}
          variants={scaleInVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={isDragging ? { duration: 0 } : springFast}
          className="fixed flex flex-col rounded-2xl border bg-popover shadow-lg"
          style={
            {
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${WINDOW_WIDTH}px`,
              height: `${panelHeight}px`,
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
              onSelectWorktreeByPath={onSelectWorktreeByPath}
              onSwitchTab={onSwitchTab}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
