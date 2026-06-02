import { getPathBasename } from '@shared/utils/path';
import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { LayoutGrid, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TabId } from '@/App/constants';
import type { Session } from '@/components/chat/SessionBar';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import {
  CANVAS_CARD_DEFAULT_HEIGHT,
  CANVAS_CARD_DEFAULT_WIDTH,
  computeArrangedCanvasHeight,
  computeArrangedPositions,
} from '@/lib/arrangeSessionCanvasCards';
import { pushSessionCanvasSnapshotToPanel } from '@/lib/sessionCanvasSync';
import { refreshAllCanvasPreviews } from '@/lib/refreshCanvasPreviews';
import { getResolvedSessionPreview } from '@/stores/sessionPreviewCache';
import { cn } from '@/lib/utils';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useSettingsStore } from '@/stores/settings';
import { useTerminalStore } from '@/stores/terminal';
import { type CanvasCardItem, SessionCanvasCard } from './SessionCanvasCard';
import {
  SessionCanvasContextMenu,
  type SessionCanvasContextMenuState,
} from './SessionCanvasContextMenu';
import { resolveSessionCanvasCardTitle } from './sessionCanvasTitle';
import { getDefaultCardPosition } from './useSessionCanvasCardDrag';
import { getSessionCanvasCardKey } from '@/lib/sessionCanvasCardKey';
import { resolveSessionPtyId } from '@/stores/sessionPtyRegistry';

interface SessionCanvasPanelProps {
  variant?: 'embedded' | 'floating';
  isActive?: boolean;
  syncPreviews?: boolean;
  onClose?: () => void;
  onSelectWorktreeByPath?: (worktreePath: string) => Promise<void> | void;
  onSwitchTab?: (tab: TabId) => void;
  externalItems?: CanvasCardItem[];
  onFocusExternal?: (item: CanvasCardItem) => void;
}

function buildCardItems(
  agentSessions: Session[],
  runtimeStates: ReturnType<typeof useAgentSessionsStore.getState>['runtimeStates'],
  terminalSessions: ReturnType<typeof useTerminalStore.getState>['sessions']
): CanvasCardItem[] {
  const agents: CanvasCardItem[] = agentSessions.map((session) => {
    const runtime = runtimeStates[session.id];
    return {
      kind: 'agent',
      session,
      previewText: getResolvedSessionPreview(
        'agent',
        session.id,
        runtime?.previewText,
        runtime?.previewEscapePending
      ),
      outputState: runtime?.outputState ?? 'idle',
      ptyIdHint: resolveSessionPtyId(session.id),
    };
  });

  const terminals: CanvasCardItem[] = terminalSessions.map((session) => ({
    kind: 'terminal',
    session,
    ptyIdHint: resolveSessionPtyId(session.id),
    previewText: getResolvedSessionPreview(
      'terminal',
      session.id,
      session.previewText,
      session.previewEscapePending
    ),
  }));

  return [...agents, ...terminals];
}

export function SessionCanvasPanel({
  variant = 'embedded',
  isActive = false,
  syncPreviews = false,
  onClose,
  onSelectWorktreeByPath,
  onSwitchTab,
  externalItems,
  onFocusExternal,
}: SessionCanvasPanelProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedCardKey, setFocusedCardKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<SessionCanvasContextMenuState | null>(null);
  const [renameToken, setRenameToken] = useState(0);
  const [renameTargetKey, setRenameTargetKey] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const agentSessions = useAgentSessionsStore((s) => s.sessions);
  const runtimeStates = useAgentSessionsStore((s) => s.runtimeStates);
  const terminalSessions = useTerminalStore((s) => s.sessions);
  const setAgentActiveId = useAgentSessionsStore((s) => s.setActiveId);
  const markSessionActive = useAgentSessionsStore((s) => s.markSessionActive);
  const updateAgentSession = useAgentSessionsStore((s) => s.updateSession);
  const updateTerminalSession = useTerminalStore((s) => s.updateSession);
  const setTerminalActive = useTerminalStore((s) => s.setActiveSession);
  const setCardPosition = useSettingsStore((s) => s.setSessionCanvasCardPosition);
  const setCardSize = useSettingsStore((s) => s.setSessionCanvasCardSize);

  useEffect(() => {
    if (!syncPreviews || externalItems) return;
    refreshAllCanvasPreviews();
  }, [syncPreviews, externalItems]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setCanvasSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!focusedCardKey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusedCardKey(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusedCardKey]);

  const allItems = useMemo(() => {
    if (externalItems) return externalItems;
    return buildCardItems(agentSessions, runtimeStates, terminalSessions);
  }, [externalItems, agentSessions, runtimeStates, terminalSessions]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter((item) => {
      const cwd = item.session.cwd.toLowerCase();
      const repo = (
        item.kind === 'agent' ? item.session.repoPath : item.session.cwd
      ).toLowerCase();
      const title = resolveSessionCanvasCardTitle(item, t('Terminal')).toLowerCase();
      const preview = (item.previewText ?? '').toLowerCase();
      return (
        cwd.includes(q) ||
        repo.includes(q) ||
        title.includes(q) ||
        preview.includes(q) ||
        getPathBasename(item.session.cwd).toLowerCase().includes(q)
      );
    });
  }, [allItems, searchQuery, t]);

  const focusedItem = useMemo(
    () =>
      focusedCardKey
        ? filteredItems.find((item) => getSessionCanvasCardKey(item) === focusedCardKey)
        : undefined,
    [filteredItems, focusedCardKey]
  );

  const focusSize = useMemo(
    () => ({
      width: Math.max(280, Math.round(canvasSize.width * 0.6)),
      height: Math.max(240, Math.round(canvasSize.height * 0.6)),
    }),
    [canvasSize.width, canvasSize.height]
  );

  const agentCount = agentSessions.length;
  const terminalCount = terminalSessions.length;

  const handleFocus = useCallback(
    async (item: CanvasCardItem) => {
      if (onFocusExternal) {
        onFocusExternal(item);
        return;
      }
      const cwd = item.session.cwd;
      await onSelectWorktreeByPath?.(cwd);
      if (item.kind === 'agent') {
        setAgentActiveId(item.session.repoPath, cwd, item.session.id);
        markSessionActive(item.session.id);
        onSwitchTab?.('chat');
      } else {
        setTerminalActive(item.session.id);
        onSwitchTab?.('terminal');
      }
    },
    [
      onFocusExternal,
      onSelectWorktreeByPath,
      onSwitchTab,
      setAgentActiveId,
      setTerminalActive,
      markSessionActive,
    ]
  );

  const handleRenameSession = useCallback(
    (kind: SessionCanvasCardKind, sessionId: string, name: string) => {
      if (externalItems) {
        window.electronAPI.sessionCanvasPanel.renameSession({ kind, sessionId, title: name });
        return;
      }
      if (kind === 'agent') {
        updateAgentSession(sessionId, { name, terminalTitle: undefined, userRenamed: true });
      } else {
        updateTerminalSession(sessionId, { title: name });
      }
      pushSessionCanvasSnapshotToPanel();
    },
    [externalItems, updateAgentSession, updateTerminalSession]
  );

  const handleArrange = useCallback(() => {
    const containerWidth = canvasRef.current?.clientWidth ?? canvasSize.width;
    const positions = computeArrangedPositions(filteredItems, containerWidth);
    for (const item of filteredItems) {
      const key = getSessionCanvasCardKey(item);
      const pos = positions[key];
      if (pos) setCardPosition(key, pos);
      setCardSize(key, {
        width: CANVAS_CARD_DEFAULT_WIDTH,
        height: CANVAS_CARD_DEFAULT_HEIGHT,
      });
    }
    setContextMenu(null);
    setFocusedCardKey(null);
  }, [filteredItems, canvasSize.width, setCardPosition, setCardSize]);

  const handleCardClick = useCallback(
    (item: CanvasCardItem, event: React.MouseEvent) => {
      if (event.ctrlKey || event.metaKey) {
        setFocusedCardKey(null);
        void handleFocus(item);
        return;
      }
      setFocusedCardKey(getSessionCanvasCardKey(item));
    },
    [handleFocus]
  );

  const openContextMenu = useCallback((event: React.MouseEvent, item: CanvasCardItem | null) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, item });
  }, []);

  const canvasMinHeight = useMemo(() => {
    if (focusedCardKey) {
      return Math.max(360, canvasSize.height);
    }
    return computeArrangedCanvasHeight(
      filteredItems.length,
      canvasSize.width,
      CANVAS_CARD_DEFAULT_WIDTH,
      CANVAS_CARD_DEFAULT_HEIGHT
    );
  }, [filteredItems.length, canvasSize.width, canvasSize.height, focusedCardKey]);

  const isFloating = variant === 'floating';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={cn(
          'flex shrink-0 flex-col gap-3 px-4',
          isFloating ? 'border-b py-3' : 'border-b py-3'
        )}
      >
        {!isFloating && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">{t('Session Canvas')}</h2>
              <p className="text-xs text-muted-foreground">
                {t('{{agents}} agents · {{terminals}} terminals', {
                  agents: agentCount,
                  terminals: terminalCount,
                })}
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                title={t('Close')}
                aria-label={t('Close')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search sessions...')}
            className="no-drag h-9 pl-9"
          />
        </div>
      </div>

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-y-auto p-4"
        onContextMenu={(e) => openContextMenu(e, null)}
      >
        {filteredItems.length === 0 ? (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <Empty className="border-0">
              <EmptyMedia variant="icon">
                <LayoutGrid className="h-4.5 w-4.5" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>
                  {allItems.length === 0
                    ? t('No active sessions')
                    : t('No matching sessions')}
                </EmptyTitle>
                <EmptyDescription>
                  {allItems.length === 0
                    ? t('Open Agent or Terminal tabs to start sessions, then view them here.')
                    : t('Try a different search term.')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="relative w-full" style={{ minHeight: canvasMinHeight }}>
            {filteredItems.map((item, index) => {
              const key = getSessionCanvasCardKey(item);
              const isFocused = focusedCardKey === key;
              const isDimmed = Boolean(focusedCardKey && !isFocused);
              return (
                <SessionCanvasCard
                  key={`${item.kind}-${item.session.id}`}
                  item={item}
                  index={index}
                  isActive={isActive}
                  isFocused={isFocused && !focusedItem}
                  isDimmed={isDimmed}
                  disableDrag={Boolean(focusedCardKey)}
                  onCardClick={(e) => handleCardClick(item, e)}
                  onRenameSession={handleRenameSession}
                  onContextMenu={(e) => openContextMenu(e, item)}
                  renameRequestToken={
                    renameTargetKey === key && focusedCardKey !== key ? renameToken : undefined
                  }
                />
              );
            })}
          </div>
        )}

        {focusedItem ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/55"
            onClick={() => setFocusedCardKey(null)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className="relative"
              style={{ width: focusSize.width, height: focusSize.height }}
              onClick={(e) => e.stopPropagation()}
            >
              <SessionCanvasCard
                item={focusedItem}
                index={0}
                isActive={isActive}
                isFocused
                sizeOverride={focusSize}
                positionOverride={{ x: 0, y: 0 }}
                disableDrag
                onCardClick={(e) => handleCardClick(focusedItem, e)}
                onRenameSession={handleRenameSession}
                onContextMenu={(e) => openContextMenu(e, focusedItem)}
                renameRequestToken={
                  renameTargetKey === getSessionCanvasCardKey(focusedItem)
                    ? renameToken
                    : undefined
                }
              />
            </div>
          </div>
        ) : null}
      </div>

      <SessionCanvasContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onArrange={handleArrange}
        onRename={
          contextMenu?.item
            ? () => {
                const item = contextMenu.item!;
                const key = getSessionCanvasCardKey(item);
                setContextMenu(null);
                window.setTimeout(() => {
                  setRenameTargetKey(key);
                  setRenameToken((n) => n + 1);
                }, 0);
              }
            : undefined
        }
        onJumpToSession={
          contextMenu?.item
            ? () => {
                const item = contextMenu.item!;
                setContextMenu(null);
                setFocusedCardKey(null);
                void handleFocus(item);
              }
            : undefined
        }
      />
    </div>
  );
}
