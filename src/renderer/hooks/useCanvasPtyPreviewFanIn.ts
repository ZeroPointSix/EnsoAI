import { useEffect } from 'react';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { useSessionPtyRegistry } from '@/stores/sessionPtyRegistry';
import { hasTerminalPreviewReader } from '@/stores/terminalPreviewRegistry';
import { useTerminalStore } from '@/stores/terminal';

/**
 * 当某会话未挂载 xterm 预览读取器时，直接从 PTY 流追加看板预览文本。
 * 避免看板卡片在启动/切换后长时间看不到终端输出。
 */
export function useCanvasPtyPreviewFanIn(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    return window.electronAPI.terminal.onData(({ id, data }) => {
      if (!data) return;
      const agentIds = new Set(useAgentSessionsStore.getState().sessions.map((s) => s.id));
      const appendAgent = useAgentSessionsStore.getState().appendSessionPreview;
      const appendTerminal = useTerminalStore.getState().appendTerminalPreview;
      const ptyMap = useSessionPtyRegistry.getState().ptyBySessionId;

      for (const [sessionId, ptyId] of Object.entries(ptyMap)) {
        if (ptyId !== id) continue;
        if (hasTerminalPreviewReader(sessionId)) break;
        if (agentIds.has(sessionId)) {
          appendAgent(sessionId, data);
        } else {
          appendTerminal(sessionId, data);
        }
        break;
      }
    });
  }, [enabled]);
}
