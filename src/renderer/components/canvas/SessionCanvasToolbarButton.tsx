import { LayoutGrid } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useTerminalStore } from '@/stores/terminal';

interface SessionCanvasToolbarButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

/** Global toolbar control for the session canvas (sidebar header). */
export function SessionCanvasToolbarButton({
  isOpen,
  onToggle,
  className,
}: SessionCanvasToolbarButtonProps) {
  const { t } = useI18n();
  const agentCount = useAgentSessionsStore((s) => s.sessions.length);
  const terminalCount = useTerminalStore((s) => s.sessions.length);
  const sessionCount = agentCount + terminalCount;

  return (
    <button
      type="button"
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-md no-drag transition-colors',
        isOpen
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        className
      )}
      onClick={onToggle}
      title={t('Session Canvas (Ctrl+5)')}
      aria-label={t('Session Canvas (Ctrl+5)')}
      aria-pressed={isOpen}
    >
      <LayoutGrid className="h-4 w-4" />
      {sessionCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
          {sessionCount > 99 ? '99+' : sessionCount}
        </span>
      )}
    </button>
  );
}
