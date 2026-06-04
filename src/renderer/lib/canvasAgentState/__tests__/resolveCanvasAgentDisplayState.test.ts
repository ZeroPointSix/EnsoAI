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

  it('clears stale PreToolUse working when output is idle', () => {
    const state = resolveCanvasAgentDisplayState({
      outputState: 'idle',
      previewText: '* Crunched for 14s\n❯ ',
      hookState: 'working',
    });
    expect(state).toBe('idle');
  });

  it('shows working only while outputting', () => {
    const state = resolveCanvasAgentDisplayState({
      outputState: 'outputting',
      previewText: '✽ Bloviating…',
      hookState: 'working',
    });
    expect(state).toBe('working');
  });
});
