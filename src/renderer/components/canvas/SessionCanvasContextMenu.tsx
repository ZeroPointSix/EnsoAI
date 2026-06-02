import { useEffect } from 'react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { CanvasCardItem } from './SessionCanvasCard';

export interface SessionCanvasContextMenuState {
  x: number;
  y: number;
  item: CanvasCardItem | null;
}

interface SessionCanvasContextMenuProps {
  menu: SessionCanvasContextMenuState | null;
  onClose: () => void;
  onArrange: () => void;
  onRename?: () => void;
  onJumpToSession?: () => void;
}

export function SessionCanvasContextMenu({
  menu,
  onClose,
  onArrange,
  onRename,
  onJumpToSession,
}: SessionCanvasContextMenuProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!menu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [menu, onClose]);

  if (!menu) return null;

  const itemClass =
    'flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground';

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default"
        aria-label={t('Close menu')}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed z-[61] min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md'
        )}
        style={{ left: menu.x, top: menu.y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button type="button" className={itemClass} onClick={onArrange}>
          {t('Arrange cards')}
        </button>
        {menu.item && onRename ? (
          <button type="button" className={itemClass} onClick={onRename}>
            {t('Rename')}
          </button>
        ) : null}
        {menu.item && onJumpToSession ? (
          <button type="button" className={itemClass} onClick={onJumpToSession}>
            {t('Jump to session')}
          </button>
        ) : null}
      </div>
    </>
  );
}
