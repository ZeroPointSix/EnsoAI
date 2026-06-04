import { useEffect } from 'react';
import { useAgentSessionsStore } from '@/stores/agentSessions';
import { sessionCanvasLog, sessionCanvasLogThrottled, shortSessionId } from '@/lib/sessionCanvasLog';
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
    sessionCanvasLog('Preview', 'pty preview fan-in enabled');

    return window.electronAPI.terminal.onData(({ id, data }) => {
      if (!data) return;
      const agentIds = new Set(useAgentSessionsStore.getState().sessions.map((s) => s.id));
      const appendAgent = useAgentSessionsStore.getState().appendSessionPreview;
      const appendTerminal = useTerminalStore.getState().appendTerminalPreview;
      const ptyMap = useSessionPtyRegistry.getState().ptyBySessionId;

      for (const [sessionId, ptyId] of Object.entries(ptyMap)) {
        if (ptyId !== id) continue;
        // 已挂载 xterm 时由 AgentTerminal.handleData → appendSessionPreview 负责，避免重复追加
        if (hasTerminalPreviewReader(sessionId)) break;
        if (agentIds.has(sessionId)) {
          appendAgent(sessionId, data);
          sessionCanvasLogThrottled(
            `fanin-agent-${sessionId}`,
            5000,
            'Preview',
            'fan-in append agent',
            { sessionId: shortSessionId(sessionId), bytes: data.length }
          );
        } else {
          appendTerminal(sessionId, data);
        }
        break;
      }
    });
  }, [enabled]);
}
