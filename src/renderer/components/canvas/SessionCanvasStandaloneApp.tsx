import type { SessionCanvasFocusParams, SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { LayoutGrid, RotateCcw, X } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useMemo } from 'react';
import { getAgentTaskPanelHeaderClassName, isMacPlatform } from '@/components/agent-tasks/agentTaskPanelTitleBar';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { snapshotCardsToCanvasItems } from '@/lib/snapshotToCanvasItems';
import { useSessionCanvasStandaloneStore } from '@/stores/sessionCanvasStandalone';
import type { CanvasCardItem } from './SessionCanvasCard';
import { SessionCanvasPanel } from './SessionCanvasPanel';

const platform = window.electronAPI.env.platform;
const isMac = isMacPlatform(platform);
const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

export function SessionCanvasStandaloneApp() {
  const { t } = useI18n();
  const snapshot = useSessionCanvasStandaloneStore((s) => s.snapshot);
  const setSnapshot = useSessionCanvasStandaloneStore((s) => s.setSnapshot);

  const applySnapshot = useCallback(
    (next: SessionCanvasSnapshot) => {
      setSnapshot(next);
    },
    [setSnapshot]
  );

  useEffect(() => {
    window.electronAPI.sessionCanvasPanel.getSnapshot();
    return window.electronAPI.sessionCanvasPanel.onSnapshotResponse((data) => {
      applySnapshot(data);
    });
  }, [applySnapshot]);

  useEffect(() => {
    return window.electronAPI.sessionCanvasPanel.onSync((data) => {
      applySnapshot(data);
    });
  }, [applySnapshot]);

  const items = useMemo(
    () => (snapshot ? snapshotCardsToCanvasItems(snapshot.cards) : []),
    [snapshot]
  );

  const agentCount = items.filter((i) => i.kind === 'agent').length;
  const terminalCount = items.filter((i) => i.kind === 'terminal').length;

  const handleFocusExternal = useCallback((item: CanvasCardItem) => {
    const repoPath = item.kind === 'agent' ? item.session.repoPath : item.session.cwd;
    const params: SessionCanvasFocusParams = {
      kind: item.kind,
      sessionId: item.session.id,
      repoPath,
      cwd: item.session.cwd,
    };
    window.electronAPI.sessionCanvasPanel.focusSession(params);
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI.sessionCanvasPanel.toggle();
  }, []);

  const handleResetBounds = useCallback(() => {
    window.electronAPI.sessionCanvasPanel.resetBounds();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className={getAgentTaskPanelHeaderClassName(platform)} style={dragRegionStyle}>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          <span className="text-sm font-medium">{t('Session Canvas')}</span>
          <span className="text-[10px] text-muted-foreground">
            {t('{{agents}} agents · {{terminals}} terminals', {
              agents: agentCount,
              terminals: terminalCount,
            })}
          </span>
        </div>
        <div className="flex items-center gap-1" style={noDragRegionStyle}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetBounds}
            className="h-7 w-7"
            title={t('Reset Position & Size')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {!isMac && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-7 w-7"
              title={t('Close')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <SessionCanvasPanel
          variant="floating"
          isActive
          externalItems={items}
          onFocusExternal={handleFocusExternal}
        />
      </div>
    </div>
  );
}
