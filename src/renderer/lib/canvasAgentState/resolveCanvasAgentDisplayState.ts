import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';
import type { OutputState } from '@/stores/agentSessions';
import { inferPreviewSignalReason } from './inferDisplayFromPreview';

/**
 * 对齐 OpenCove AgentRuntimeStatus / ptyState：
 * - running  ⟷ outputting / PreToolUse（执行中）→ 黄灯 working
 * - standby  ⟷ idle（等待输入）→ 灰灯
 * - 完成     ⟷ Stop / unread → 绿灯 completed
 *
 * 不解析预览里的 Cooked/esc to interrupt，避免历史 scrollback 误判。
 */
export function resolveCanvasAgentDisplayState(input: {
  outputState: OutputState;
  previewText?: string;
  previewRawTail?: string;
  hookState?: CanvasAgentDisplayState;
}): CanvasAgentDisplayState {
  const previewSignal = inferPreviewSignalReason(input.previewText, input.previewRawTail);
  if (
    input.hookState === 'blocked' ||
    previewSignal.kind === 'blocked' ||
    previewSignal.kind === 'error'
  ) {
    return 'blocked';
  }

  if (input.hookState === 'completed' || input.outputState === 'unread') {
    return 'completed';
  }

  if (input.outputState === 'outputting') {
    return 'working';
  }

  return 'idle';
}
