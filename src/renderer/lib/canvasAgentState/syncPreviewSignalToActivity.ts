import {
  type PreviewInterruptReason,
  type PreviewInterruptSignal,
} from './analyzeTerminalPreviewSignals';
import { sessionCanvasLog, shortSessionId } from '@/lib/sessionCanvasLog';
import { useAgentRuntimeActivityStore } from '@/stores/agentRuntimeActivity';

export function syncPreviewSignalToActivity(
  sessionId: string,
  signal: PreviewInterruptSignal,
  prevReason: PreviewInterruptReason | undefined
): void {
  const { getPhase, reportPreviewBlocked, clearPreviewBlocked } =
    useAgentRuntimeActivityStore.getState();
  const phase = getPhase(sessionId);
  const sid = shortSessionId(sessionId);

  if (signal.kind !== 'none') {
    if (prevReason !== signal.reason) {
      sessionCanvasLog('PreviewSignal', 'detected → blocked', {
        sessionId: sid,
        kind: signal.kind,
        reason: signal.reason,
        phaseBefore: phase,
        flags: signal.flags,
        sampleLine: signal.sampleLine,
      });
    }
    reportPreviewBlocked(sessionId, `${signal.kind}:${signal.reason}`);
    return;
  }

  if (prevReason && prevReason !== 'none') {
    sessionCanvasLog('PreviewSignal', 'cleared', {
      sessionId: sid,
      wasReason: prevReason,
      phaseBefore: phase,
    });
    clearPreviewBlocked(sessionId, 'preview-signal-cleared');
  }
}
