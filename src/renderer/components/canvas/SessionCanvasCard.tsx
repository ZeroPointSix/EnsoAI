import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { Bot, GripVertical, Sparkles, Terminal } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { Session } from '@/components/chat/SessionBar';
import { Badge } from '@/components/ui/badge';
import { GlowCard } from '@/components/ui/glow-card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAgentSessionsStore, type OutputState } from '@/stores/agentSessions';
import { getResolvedSessionPreview } from '@/stores/sessionPreviewCache';
import type { TerminalSessionEntry } from '@/stores/terminal';
import { useSessionCanvasRename } from './sessionCanvasRename';
import { resolveSessionCanvasCardTitle } from './sessionCanvasTitle';
import { resolveSessionCanvasSubtitle } from './sessionCanvasSubtitle';
import { resolveSessionCanvasCardPreviewText } from '@/lib/resolveSessionCanvasCardPreview';
import { resolveCanvasAgentDisplayState } from '@/lib/canvasAgentState/resolveCanvasAgentDisplayState';
import { useCanvasCardDisplayStore } from '@/stores/canvasCardDisplayStore';
import {
  type CanvasAgentDisplayState,
  CanvasAgentStatusDot,
  canvasAgentIconAccentClass,
} from './CanvasAgentStatusDot';
import { useSessionCanvasPtyExists } from '@/hooks/useSessionCanvasPtyExists';
import { SessionCanvasPreview } from './SessionCanvasPreview';
import { SessionCanvasQuickInput } from './SessionCanvasQuickInput';
import { getSessionCanvasCardKey, useSessionCanvasCardResize } from './useSessionCanvasCardResize';
import { useSessionCanvasCardDrag } from './useSessionCanvasCardDrag';

export type CanvasCardItem =
  | {
      kind: 'agent';
      session: Session;
      previewText?: string;
      outputState: OutputState;
      /** 主窗快照同步的展示状态（独立看板） */
      agentDisplayState?: CanvasAgentDisplayState;
      /** Resolved `pty-N` id for quick input (standalone snapshot or registry) */
      ptyIdHint?: string;
    }
  | {
      kind: 'terminal';
      session: TerminalSessionEntry;
      previewText?: string;
      ptyIdHint?: string;
    };

interface SessionCanvasCardProps {
  item: CanvasCardItem;
  index: number;
  isActive?: boolean;
  isFocused?: boolean;
  isDimmed?: boolean;
  sizeOverride?: { width: number; height: number };
  positionOverride?: { x: number; y: number };
  disableDrag?: boolean;
  onCardClick: (event: React.MouseEvent) => void;
  onRenameSession?: (kind: SessionCanvasCardKind, sessionId: string, name: string) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  renameRequestToken?: number;
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

function agentDisplayStateToGlow(
  state: CanvasAgentDisplayState
): 'idle' | 'running' | 'waiting_input' | 'completed' {
  switch (state) {
    case 'working':
      return 'running';
    case 'blocked':
      return 'waiting_input';
    case 'completed':
      return 'completed';
    default:
      return 'idle';
  }
}

export function SessionCanvasCard({
  item,
  index,
  isActive = true,
  isFocused = false,
  isDimmed = false,
  sizeOverride,
  positionOverride,
  disableDrag = false,
  onCardClick,
  onRenameSession,
  onContextMenu,
  renameRequestToken,
}: SessionCanvasCardProps) {
  const { t } = useI18n();
  const cardKey = getSessionCanvasCardKey(item);
  const { width, height, handleResizePointerDown } = useSessionCanvasCardResize(cardKey, sizeOverride);
  const dragEnabled = !disableDrag && !isFocused && !positionOverride;
  const { position, isDragging, handleDragPointerDown } = useSessionCanvasCardDrag(
    cardKey,
    index,
    positionOverride
  );

  const isAgent = item.kind === 'agent';
  const title = resolveSessionCanvasCardTitle(item, t('Terminal'));
  const subtitle = resolveSessionCanvasSubtitle(item, t('Shell'));
  const hasLocalAgentRuntime = useAgentSessionsStore(
    (s) => item.kind === 'agent' && Boolean(s.runtimeStates[item.session.id])
  );
  const liveAgentPreview = useAgentSessionsStore((s) => {
    if (item.kind !== 'agent' || !hasLocalAgentRuntime) return undefined;
    const runtime = s.runtimeStates[item.session.id];
    return getResolvedSessionPreview(
      'agent',
      item.session.id,
      runtime?.previewText,
      runtime?.previewEscapePending
    );
  });

  const previewText =
    item.kind === 'agent'
      ? resolveSessionCanvasCardPreviewText(
          item.previewText,
          liveAgentPreview,
          hasLocalAgentRuntime
        )
      : resolveSessionCanvasCardPreviewText(item.previewText, undefined, false);
  const ptyIdHint = item.ptyIdHint;
  const { ptyExists } = useSessionCanvasPtyExists(item.session.id, !isFocused, ptyIdHint);
  const Icon = isAgent ? Sparkles : Terminal;

  const handleCommitRename = useCallback(
    (name: string) => {
      onRenameSession?.(item.kind, item.session.id, name);
    },
    [onRenameSession, item]
  );

  const {
    isRenaming,
    renameValue,
    setRenameValue,
    commitRename,
    beginRename,
    cancelRename,
  } = useSessionCanvasRename({
    displayTitle: title,
    renameRequestToken,
    canRename: Boolean(onRenameSession),
    onCommit: handleCommitRename,
  });

  const handleBeginRename = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      beginRename();
    },
    [beginRename]
  );

  const titleNode = isRenaming ? (
    <Input
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') {
          cancelRename();
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
      title={onRenameSession ? t('Double-click to rename') : title}
      onDoubleClick={handleBeginRename}
    >
      {title}
    </span>
  );

  const hookDisplayState = useCanvasCardDisplayStore((s) =>
    isAgent && item.kind === 'agent' ? s.bySessionId[item.session.id] : undefined
  );

  const snapshotDisplayState =
    isAgent && item.kind === 'agent' ? item.agentDisplayState : undefined;

  const agentDisplayState: CanvasAgentDisplayState = useMemo(() => {
    if (!isAgent || item.kind !== 'agent') return 'idle';
    return resolveCanvasAgentDisplayState({
      outputState: item.outputState,
      previewText,
      hookState: hookDisplayState ?? snapshotDisplayState,
    });
  }, [isAgent, item, previewText, hookDisplayState, snapshotDisplayState]);

  const glowState = isFocused
    ? 'idle'
    : item.kind === 'agent'
      ? agentDisplayStateToGlow(agentDisplayState)
      : outputStateToGlow('idle');
  const showAgentGlow =
    item.kind === 'agent' &&
    !isFocused &&
    (item.outputState !== 'idle' || agentDisplayState !== 'idle');

  const body = (
    <div
      className={cn('flex h-full min-h-0 flex-col gap-2 p-3 text-left', isFocused && 'overflow-hidden')}
    >
      <div className="flex min-w-0 items-start gap-2">
        {dragEnabled ? (
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
        ) : (
          <span className="mt-0.5 h-7 w-5 shrink-0" />
        )}
        <div
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            isAgent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            isAgent && canvasAgentIconAccentClass(agentDisplayState)
          )}
        >
          <Icon className="h-4 w-4" />
          {isAgent ? (
            <CanvasAgentStatusDot
              state={agentDisplayState}
              className="absolute -right-0.5 -top-0.5 h-3 w-3 ring-2 ring-card"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {titleNode}
            {!isAgent ? (
              <Badge variant="outline" className="shrink-0 h-5 px-1.5 text-[10px]">
                {t('Shell')}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        </div>
        {isAgent && (
          <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
        )}
      </div>

      {isFocused ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(4.5rem,38%)_minmax(11rem,1fr)] gap-2 overflow-hidden">
          <SessionCanvasPreview
            text={previewText}
            placeholder={t('No output yet — open this session to stream preview')}
            isActive={isActive}
            className="min-h-0 flex-1"
          />
          <div className="flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden">
            <SessionCanvasQuickInput
              sessionId={item.session.id}
              kind={item.kind}
              agentId={isAgent ? item.session.agentId : undefined}
              cwd={item.session.cwd}
              ptyIdHint={item.ptyIdHint}
              expanded
              className="min-h-0 flex-1"
            />
            <p className="shrink-0 text-[10px] text-muted-foreground">
              {t('Ctrl+click to jump to session · Esc to close')}
            </p>
          </div>
        </div>
      ) : (
        <>
          <SessionCanvasPreview
            text={previewText}
            placeholder={t('No output yet — open this session to stream preview')}
            isActive={isActive}
          />
          <p className="truncate text-[10px] text-muted-foreground/80" title={item.session.cwd}>
            {item.session.cwd}
          </p>
        </>
      )}
    </div>
  );

  const shellClass = cn(
    'relative flex h-full w-full flex-col rounded-lg border border-border/50 bg-card/80 text-left shadow-sm',
    'transition-shadow hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isDragging && 'ring-2 ring-primary/40',
    isFocused && 'ring-2 ring-primary border-primary/50 shadow-lg overflow-hidden',
    isDimmed && 'opacity-50 saturate-75',
    !isFocused && ptyExists && 'ring-1 ring-primary/35 border-primary/25'
  );

  const resizeHandle =
    !isFocused && !sizeOverride ? (
      <button
        type="button"
        aria-label={t('Resize')}
        className="absolute bottom-1 right-1 z-10 flex h-4 w-4 cursor-se-resize items-end justify-end rounded-sm p-0.5 text-muted-foreground/70 hover:text-foreground"
        onPointerDown={handleResizePointerDown}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="block h-2 w-2 border-r-2 border-b-2 border-current" />
      </button>
    ) : null;

  const resolvedPosition = positionOverride ?? position;
  const positionedStyle = {
    position: 'absolute' as const,
    left: resolvedPosition.x,
    top: resolvedPosition.y,
    width,
    height,
    zIndex: isFocused ? 50 : isDragging ? 20 : isDimmed ? 0 : 1,
  };

  const handleShellClick = (e: React.MouseEvent) => {
    onCardClick(e);
  };

  const handleShellContextMenu = (e: React.MouseEvent) => {
    onContextMenu?.(e);
  };

  const shellInteractiveProps = isFocused
    ? {}
    : {
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleShellClick(e as unknown as React.MouseEvent);
          }
        },
      };

  const shellHandlers = {
    onClick: handleShellClick,
    onContextMenu: handleShellContextMenu,
  };

  if (showAgentGlow) {
    return (
      <div style={positionedStyle} {...shellHandlers} {...shellInteractiveProps}>
        <GlowCard as="div" state={glowState} className={shellClass}>
          {body}
          {resizeHandle}
        </GlowCard>
      </div>
    );
  }

  return (
    <div style={positionedStyle}>
      <div className={shellClass} {...shellHandlers} {...shellInteractiveProps}>
        {body}
      </div>
      {resizeHandle}
    </div>
  );
}
