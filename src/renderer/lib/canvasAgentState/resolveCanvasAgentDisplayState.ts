import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';
import type { OutputState } from '@/stores/agentSessions';
import { inferDisplayFromPreview } from './inferDisplayFromPreview';

const PRIORITY: Record<CanvasAgentDisplayState, number> = {
  idle: 0,
  completed: 1,
  working: 2,
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

/** 合并 Hook、preview 推断、outputState，供看板卡片展示 */
export function resolveCanvasAgentDisplayState(input: {
  outputState: OutputState;
  previewText?: string;
  hookState?: CanvasAgentDisplayState;
}): CanvasAgentDisplayState {
  let resolved: CanvasAgentDisplayState = 'idle';

  if (input.hookState) {
    resolved = input.hookState;
  }

  const fromPreview = inferDisplayFromPreview(input.previewText);
  if (fromPreview) {
    resolved = pickHigher(resolved, fromPreview);
  }

  const fromOutput = outputStateToDisplay(input.outputState);
  resolved = pickHigher(resolved, fromOutput);

  return resolved;
}
