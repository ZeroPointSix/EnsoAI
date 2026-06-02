import { getPathBasename } from '@shared/utils/path';
import { Bot, GripVertical, Sparkles, Terminal } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Session } from '@/components/chat/SessionBar';
import { Badge } from '@/components/ui/badge';
import { GlowCard } from '@/components/ui/glow-card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { OutputState } from '@/stores/agentSessions';
import type { TerminalSessionEntry } from '@/stores/terminal';
import { resolveSessionCanvasCardTitle } from './sessionCanvasTitle';
import { SessionCanvasPreview } from './SessionCanvasPreview';
import { getSessionCanvasCardKey, useSessionCanvasCardResize } from './useSessionCanvasCardResize';
import { useSessionCanvasCardDrag } from './useSessionCanvasCardDrag';

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
  index: number;
  isActive?: boolean;
  onFocus: () => void;
  onRenameAgentSession?: (sessionId: string, name: string) => void;
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

export function SessionCanvasCard({
  item,
  index,
  isActive = true,
  onFocus,
  onRenameAgentSession,
}: SessionCanvasCardProps) {
  const { t } = useI18n();
  const cardKey = getSessionCanvasCardKey(item);
  const { width, height, handleResizePointerDown } = useSessionCanvasCardResize(cardKey);
  const { position, isDragging, handleDragPointerDown } = useSessionCanvasCardDrag(cardKey, index);

  const isAgent = item.kind === 'agent';
  const title = resolveSessionCanvasCardTitle(item, t('Terminal'));
  const repoName = getPathBasename(isAgent ? item.session.repoPath : item.session.cwd);
  const worktreeLabel = getPathBasename(item.session.cwd);
  const previewText = item.previewText;
  const Icon = isAgent ? Sparkles : Terminal;

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);

  const commitRename = useCallback(() => {
    const next = renameValue.trim();
    setIsRenaming(false);
    if (!isAgent || !onRenameAgentSession || !next || next === title) return;
    onRenameAgentSession(item.session.id, next);
  }, [renameValue, title, isAgent, onRenameAgentSession, item]);

  const titleNode = isRenaming ? (
    <Input
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') {
          setRenameValue(title);
          setIsRenaming(false);
        }
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className="h-7 min-w-0 flex-1 text-sm"
      autoFocus
    />
  ) : (
    <span
      className="min-w-0 flex-1 truncate text-sm font-medium"
      title={onRenameAgentSession && isAgent ? t('Double-click to rename') : title}
      onDoubleClick={(e) => {
        if (!onRenameAgentSession || !isAgent) return;
        e.preventDefault();
        e.stopPropagation();
        setRenameValue(title);
        setIsRenaming(true);
      }}
    >
      {title}
    </span>
  );

  const body = (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3 text-left">
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          aria-label={t('Drag card')}
          className={cn(
            'mt-0.5 flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent/50 hover:text-foreground active:cursor-grabbing',
            isDragging && 'cursor-grabbing'
          )}
          onPointerDown={handleDragPointerDown}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
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
            {titleNode}
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

  const shellClass = cn(
    'relative flex h-full w-full flex-col rounded-lg border border-border/50 bg-card/80 text-left shadow-sm',
    'transition-shadow hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isDragging && 'ring-2 ring-primary/40'
  );

  const resizeHandle = (
    <button
      type="button"
      aria-label={t('Resize')}
      className="absolute bottom-1 right-1 z-10 flex h-4 w-4 cursor-se-resize items-end justify-end rounded-sm p-0.5 text-muted-foreground/70 hover:text-foreground"
      onPointerDown={handleResizePointerDown}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="block h-2 w-2 border-r-2 border-b-2 border-current" />
    </button>
  );

  const positionedStyle = {
    position: 'absolute' as const,
    left: position.x,
    top: position.y,
    width,
    height,
    zIndex: isDragging ? 20 : 1,
  };

  if (isAgent && item.outputState !== 'idle') {
    return (
      <div style={positionedStyle}>
        <GlowCard
          as="button"
          state={outputStateToGlow(item.outputState)}
          className={shellClass}
          onClick={onFocus}
        >
          {body}
          {resizeHandle}
        </GlowCard>
      </div>
    );
  }

  return (
    <div style={positionedStyle}>
      <button type="button" className={shellClass} onClick={onFocus}>
        {body}
      </button>
      {resizeHandle}
    </div>
  );
}
