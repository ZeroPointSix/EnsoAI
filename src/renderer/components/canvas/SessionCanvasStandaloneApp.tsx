import type { SessionCanvasFocusParams, SessionCanvasSnapshot } from '@shared/types/sessionCanvas';
import { LayoutGrid, Maximize2, Minimize2, RotateCcw, Settings, X } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { getAgentTaskPanelHeaderClassName, isMacPlatform } from '@/components/agent-tasks/agentTaskPanelTitleBar';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { snapshotCardsToCanvasItems } from '@/lib/snapshotToCanvasItems';
import { cn } from '@/lib/utils';
import { useSessionCanvasStandaloneStore } from '@/stores/sessionCanvasStandalone';
import { SessionCanvasPromptSettings } from './SessionCanvasPromptSettings';
import type { CanvasCardItem } from './SessionCanvasCard';
import { SessionCanvasPanel } from './SessionCanvasPanel';

const platform = window.electronAPI.env.platform;
const isMac = isMacPlatform(platform);
const dragRegionStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

type DisplayMode = 'compact' | 'normal' | 'maximized';

export function SessionCanvasStandaloneApp() {
  const { t } = useI18n();
  const snapshot = useSessionCanvasStandaloneStore((s) => s.snapshot);
  const setSnapshot = useSessionCanvasStandaloneStore((s) => s.setSnapshot);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('normal');
  const [openSettings, setOpenSettings] = useState(false);

  const applySnapshot = useCallback(
    (next: SessionCanvasSnapshot) => {
      setSnapshot(next);
    },
    [setSnapshot]
  );

  useEffect(() => {
    window.electronAPI.sessionCanvasPanel.getSnapshot();
    void window.electronAPI.sessionCanvasPanel.getDisplayMode().then(setDisplayMode);
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
    void window.electronAPI.sessionCanvasPanel.resetBounds().then(() => {
      setDisplayMode('normal');
    });
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    void window.electronAPI.sessionCanvasPanel.toggleFullscreen().then((maximized) => {
      setDisplayMode(maximized ? 'maximized' : 'normal');
    });
  }, []);

  const handleToggleCompact = useCallback(() => {
    const nextCompact = displayMode !== 'compact';
    void window.electronAPI.sessionCanvasPanel.setCompactMode(nextCompact).then(() => {
      setDisplayMode(nextCompact ? 'compact' : 'normal');
    });
  }, [displayMode]);

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
            onClick={() => setOpenSettings((v) => !v)}
            className={cn('h-7 w-7', openSettings && 'bg-accent')}
            title={t('Prompt templates')}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleCompact}
            className="h-7 w-7"
            title={displayMode === 'compact' ? t('Normal window') : t('Compact window')}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleFullscreen}
            className="h-7 w-7"
            title={displayMode === 'maximized' ? t('Restore window') : t('Fullscreen')}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
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
        {openSettings ? (
          <SessionCanvasPromptSettings className="h-full" />
        ) : (
          <SessionCanvasPanel
            variant="floating"
            isActive
            externalItems={items}
            onFocusExternal={handleFocusExternal}
          />
        )}
      </div>
    </div>
  );
}
