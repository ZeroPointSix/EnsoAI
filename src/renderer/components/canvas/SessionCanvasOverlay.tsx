import { useEffect } from 'react';
import type { TabId } from '@/App/constants';
import { cn } from '@/lib/utils';
import { SessionCanvasPanel } from './SessionCanvasPanel';

interface SessionCanvasOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectWorktreeByPath: (worktreePath: string) => Promise<void> | void;
  onSwitchTab?: (tab: TabId) => void;
}

/**
 * Global session canvas — overlays main content only (not sidebars).
 */
export function SessionCanvasOverlay({
  open,
  onClose,
  onSelectWorktreeByPath,
  onSwitchTab,
}: SessionCanvasOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex flex-col overflow-hidden bg-background',
        'border-l shadow-lg'
      )}
      role="dialog"
      aria-modal="true"
    >
      <SessionCanvasPanel
        isActive
        onClose={onClose}
        onSelectWorktreeByPath={onSelectWorktreeByPath}
        onSwitchTab={onSwitchTab}
      />
    </div>
  );
}
