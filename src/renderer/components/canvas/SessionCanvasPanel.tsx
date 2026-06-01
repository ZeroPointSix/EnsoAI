import { getPathBasename } from '@shared/utils/path';
import { LayoutGrid, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { refreshAllCanvasPreviews } from '@/lib/refreshCanvasPreviews';
import { getResolvedSessionPreview } from '@/stores/sessionPreviewCache';
import { cn } from '@/lib/utils';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useTerminalStore } from '@/stores/terminal';
import { type CanvasCardItem, SessionCanvasCard } from './SessionCanvasCard';

interface SessionCanvasPanelProps {
  variant?: 'embedded' | 'floating';
  isActive?: boolean;
  /** When true, sync preview text from live xterm buffers (e.g. canvas opened). */
  syncPreviews?: boolean;
  onClose?: () => void;
  onSelectWorktreeByPath?: (worktreePath: string) => Promise<void> | void;
  onSwitchTab?: (tab: TabId) => void;
  /** Standalone window: render cards from IPC snapshot instead of main-window stores. */
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
    };
  });

  const terminals: CanvasCardItem[] = terminalSessions.map((session) => ({
    kind: 'terminal',
    session,
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

  const agentSessions = useAgentSessionsStore((s) => s.sessions);
  const runtimeStates = useAgentSessionsStore((s) => s.runtimeStates);
  const terminalSessions = useTerminalStore((s) => s.sessions);
  const setAgentActiveId = useAgentSessionsStore((s) => s.setActiveId);
  const markSessionActive = useAgentSessionsStore((s) => s.markSessionActive);
  const setTerminalActive = useTerminalStore((s) => s.setActiveSession);

  useEffect(() => {
    if (!syncPreviews || externalItems) return;
    refreshAllCanvasPreviews();
  }, [syncPreviews, externalItems]);

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
      const title =
        item.kind === 'agent'
          ? (item.session.terminalTitle || item.session.name).toLowerCase()
          : (item.session.title || 'terminal').toLowerCase();
      const preview = (item.previewText ?? '').toLowerCase();
      return (
        cwd.includes(q) ||
        repo.includes(q) ||
        title.includes(q) ||
        preview.includes(q) ||
        getPathBasename(item.session.cwd).toLowerCase().includes(q)
      );
    });
  }, [allItems, searchQuery]);

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

      <div className="flex-1 overflow-y-auto p-4">
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
          <div className="flex flex-wrap content-start gap-3">
            {filteredItems.map((item) => (
              <SessionCanvasCard
                key={`${item.kind}-${item.session.id}`}
                item={item}
                isActive={isActive}
                onFocus={() => handleFocus(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
