import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';
import { inferPreviewInterruptSignal } from './analyzeTerminalPreviewSignals';

/** 从预览（可含 raw ANSI 尾 + 纯文本）推断是否应亮红灯 */
export function inferBlockedFromPreview(
  previewText: string | undefined,
  rawTail?: string
): boolean {
  const signal = inferPreviewInterruptSignal({
    rawTail,
    strippedTail: previewText,
  });
  return signal.kind === 'blocked' || signal.kind === 'error';
}

export function inferPreviewSignalReason(
  previewText: string | undefined,
  rawTail?: string
) {
  return inferPreviewInterruptSignal({ rawTail, strippedTail: previewText });
}

/** @deprecated 仅保留 blocked；working/idle 由 outputState + Hook 驱动 */
export function inferDisplayFromPreview(
  previewText: string | undefined
): CanvasAgentDisplayState | null {
  return inferBlockedFromPreview(previewText) ? 'blocked' : null;
}
