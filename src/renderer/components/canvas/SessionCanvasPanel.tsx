import { getPathBasename } from '@shared/utils/path';
import { LayoutGrid, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useTerminalStore } from '@/stores/terminal';
import { type CanvasCardItem, SessionCanvasCard } from './SessionCanvasCard';

interface SessionCanvasPanelProps {
  isActive?: boolean;
  onSelectWorktreeByPath: (worktreePath: string) => Promise<void> | void;
  onSwitchTab?: (tab: TabId) => void;
}

function buildCardItems(
  agentSessions: Session[],
  runtimeStates: ReturnType<typeof useAgentSessionsStore.getState>['runtimeStates'],
  terminalSessions: ReturnType<typeof useTerminalStore.getState>['sessions']
): CanvasCardItem[] {
  const agents: CanvasCardItem[] = agentSessions.map((session) => ({
    kind: 'agent',
    session,
    previewText: runtimeStates[session.id]?.previewText,
    outputState: runtimeStates[session.id]?.outputState ?? 'idle',
  }));

  const terminals: CanvasCardItem[] = terminalSessions.map((session) => ({
    kind: 'terminal',
    session,
    previewText: session.previewText,
  }));

  return [...agents, ...terminals];
}

export function SessionCanvasPanel({
  isActive = false,
  onSelectWorktreeByPath,
  onSwitchTab,
}: SessionCanvasPanelProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');

  const agentSessions = useAgentSessionsStore((s) => s.sessions);
  const runtimeStates = useAgentSessionsStore((s) => s.runtimeStates);
  const terminalSessions = useTerminalStore((s) => s.sessions);
  const setAgentActiveId = useAgentSessionsStore((s) => s.setActiveId);
  const markSessionActive = useAgentSessionsStore((s) => s.markSessionActive);
  const setTerminalActive = useTerminalStore((s) => s.setActiveSession);

  const allItems = useMemo(
    () => buildCardItems(agentSessions, runtimeStates, terminalSessions),
    [agentSessions, runtimeStates, terminalSessions]
  );

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
      const cwd = item.session.cwd;
      await onSelectWorktreeByPath(cwd);
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
      onSelectWorktreeByPath,
      onSwitchTab,
      setAgentActiveId,
      setTerminalActive,
      markSessionActive,
    ]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">{t('EnsoAIPlus')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('{{agents}} agents · {{terminals}} terminals', {
                agents: agentCount,
                terminals: terminalCount,
              })}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search sessions...')}
            className="h-9 pl-9"
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
          <div
            className={cn(
              'grid gap-3',
              'grid-cols-[repeat(auto-fill,minmax(300px,1fr))]'
            )}
          >
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
