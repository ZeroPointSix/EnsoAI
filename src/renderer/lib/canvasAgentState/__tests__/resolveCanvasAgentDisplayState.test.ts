import { describe, expect, it } from 'vitest';
import { resolveCanvasAgentDisplayState } from '../resolveCanvasAgentDisplayState';

describe('resolveCanvasAgentDisplayState', () => {
  it('outputting maps to working (OpenCove running)', () => {
    expect(
      resolveCanvasAgentDisplayState({
        outputState: 'outputting',
        previewText: '* Crunched for 12s\n❯ ',
      })
    ).toBe('working');
  });

  it('idle after run is not working even with stale preview', () => {
    expect(
      resolveCanvasAgentDisplayState({
        outputState: 'idle',
        previewText: '* Crunched for 12s\nesc to interrupt\n❯ ',
        hookState: 'idle',
      })
    ).toBe('idle');
  });

  it('completed hook or unread maps to completed', () => {
    expect(
      resolveCanvasAgentDisplayState({
        outputState: 'idle',
        hookState: 'completed',
        previewText: '* Cooked for 12s\n❯ ',
      })
    ).toBe('completed');
    expect(
      resolveCanvasAgentDisplayState({
        outputState: 'unread',
        previewText: '* Cooked for 12s\n❯ ',
      })
    ).toBe('completed');
  });

  it('detects blocked from hook or preview', () => {
    expect(
      resolveCanvasAgentDisplayState({
        outputState: 'outputting',
        hookState: 'blocked',
      })
    ).toBe('blocked');
    expect(
      resolveCanvasAgentDisplayState({
        outputState: 'idle',
        previewText: 'Do you want to proceed?',
      })
    ).toBe('blocked');
  });
});
