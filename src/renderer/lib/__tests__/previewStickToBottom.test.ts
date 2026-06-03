import { describe, expect, it } from 'vitest';
import { isPreviewStickToBottom } from '../previewStickToBottom';

describe('isPreviewStickToBottom', () => {
  it('returns true when viewport is at the bottom', () => {
    expect(isPreviewStickToBottom(900, 1000, 100)).toBe(true);
  });

  it('returns true when within threshold of the bottom', () => {
    expect(isPreviewStickToBottom(860, 1000, 100, 50)).toBe(true);
  });

  it('returns false when user scrolled up beyond threshold', () => {
    expect(isPreviewStickToBottom(0, 1000, 100)).toBe(false);
  });
});
