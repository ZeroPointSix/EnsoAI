import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';
import type { OutputState } from '@/stores/agentSessions';
import { inferDisplayFromPreview } from './inferDisplayFromPreview';

/** completed 必须高于 working，否则 Stop 后预览仍含 Cooked/spinner 时绿灯永不亮 */
const PRIORITY: Record<CanvasAgentDisplayState, number> = {
  idle: 0,
  working: 1,
  completed: 2,
  blocked: 3,
};

function pickHigher(
  a: CanvasAgentDisplayState,
  b: CanvasAgentDisplayState
): CanvasAgentDisplayState {
  return PRIORITY[b] > PRIORITY[a] ? b : a;
}

export function outputStateToDisplay(state: OutputState): CanvasAgentDisplayState {
  if (state === 'outputting') return 'working';
  if (state === 'unread') return 'completed';
  return 'idle';
}

function normalizeHookState(
  hookState: CanvasAgentDisplayState | undefined,
  outputState: OutputState
): CanvasAgentDisplayState | undefined {
  if (!hookState) return undefined;
  // PreToolUse 设了 working，但进程/输出已 idle 且未收到 Stop → 视为过期
  if (hookState === 'working' && outputState !== 'outputting') {
    return outputState === 'unread' ? 'completed' : 'idle';
  }
  return hookState;
}

/** 合并 Hook、preview 推断、outputState，供看板卡片展示 */
export function resolveCanvasAgentDisplayState(input: {
  outputState: OutputState;
  previewText?: string;
  hookState?: CanvasAgentDisplayState;
}): CanvasAgentDisplayState {
  let resolved: CanvasAgentDisplayState = 'idle';

  const hookState = normalizeHookState(input.hookState, input.outputState);
  if (hookState) {
    resolved = hookState;
  }

  const fromPreview =
    input.outputState === 'outputting' ? inferDisplayFromPreview(input.previewText) : null;
  if (fromPreview) {
    resolved = pickHigher(resolved, fromPreview);
  }

  const fromOutput = outputStateToDisplay(input.outputState);
  resolved = pickHigher(resolved, fromOutput);

  return resolved;
}
