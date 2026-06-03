import { describe, expect, it } from 'vitest';
import { resolveCanvasAgentDisplayState } from '../resolveCanvasAgentDisplayState';

describe('resolveCanvasAgentDisplayState', () => {
  it('completed hook beats stale working preview', () => {
    const state = resolveCanvasAgentDisplayState({
      outputState: 'idle',
      previewText: '* Cooked for 12s\n❯ ',
      hookState: 'completed',
    });
    expect(state).toBe('completed');
  });
});
