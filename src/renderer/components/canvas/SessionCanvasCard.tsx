import { getPathBasename } from '@shared/utils/path';
import { Bot, Sparkles, Terminal } from 'lucide-react';
import type { Session } from '@/components/chat/SessionBar';
import { Badge } from '@/components/ui/badge';
import { GlowCard } from '@/components/ui/glow-card';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { OutputState } from '@/stores/agentSessions';
import type { TerminalSessionEntry } from '@/stores/terminal';
import { SessionCanvasPreview } from './SessionCanvasPreview';

export type CanvasCardItem =
  | {
      kind: 'agent';
      session: Session;
      previewText?: string;
      outputState: OutputState;
    }
  | {
      kind: 'terminal';
      session: TerminalSessionEntry;
      previewText?: string;
    };

interface SessionCanvasCardProps {
  item: CanvasCardItem;
  isActive?: boolean;
  onFocus: () => void;
}

function outputStateToGlow(state: OutputState): 'idle' | 'running' | 'waiting_input' | 'completed' {
  switch (state) {
    case 'outputting':
      return 'running';
    case 'unread':
      return 'completed';
    default:
      return 'idle';
  }
}

function StatusBadge({ outputState }: { outputState: OutputState }) {
  const { t } = useI18n();
  if (outputState === 'idle') return null;

  const variant =
    outputState === 'outputting'
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400';

  const label = outputState === 'outputting' ? t('Agent running') : t('New output');

  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
        variant,
        outputState === 'outputting' && 'animate-pulse'
      )}
    >
      {label}
    </span>
  );
}

export function SessionCanvasCard({ item, isActive = true, onFocus }: SessionCanvasCardProps) {
  const { t } = useI18n();

  const isAgent = item.kind === 'agent';
  const title = isAgent
    ? item.session.terminalTitle || item.session.name
    : item.session.title || t('Terminal');
  const repoName = getPathBasename(isAgent ? item.session.repoPath : item.session.cwd);
  const worktreeLabel = getPathBasename(item.session.cwd);
  const previewText = item.previewText;
  const Icon = isAgent ? Sparkles : Terminal;

  const body = (
    <div className="flex h-full min-h-[240px] flex-col gap-2 p-3 text-left">
      <div className="flex min-w-0 items-start gap-2">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            isAgent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
            {isAgent ? (
              <StatusBadge outputState={item.outputState} />
            ) : (
              <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px]">
                {t('Shell')}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {repoName}
            <span className="mx-1 text-border">·</span>
            {worktreeLabel}
          </p>
        </div>
        {isAgent && (
          <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
        )}
      </div>

      <SessionCanvasPreview
        text={previewText}
        placeholder={t('No output yet — open this session to stream preview')}
        isActive={isActive}
      />

      <p className="truncate text-[10px] text-muted-foreground/80" title={item.session.cwd}>
        {item.session.cwd}
      </p>
    </div>
  );

  if (isAgent && item.outputState !== 'idle') {
    return (
      <GlowCard
        as="button"
        state={outputStateToGlow(item.outputState)}
        className={cn(
          'h-full w-full rounded-lg border border-border/50 bg-card/80 text-left shadow-sm',
          'transition-shadow hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        onClick={onFocus}
      >
        {body}
      </GlowCard>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'h-full w-full rounded-lg border border-border/50 bg-card/80 text-left shadow-sm',
        'transition-shadow hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      onClick={onFocus}
    >
      {body}
    </button>
  );
}
