import { describe, expect, it } from 'vitest';
import { inferDisplayFromPreview } from '../inferDisplayFromPreview';

describe('inferDisplayFromPreview', () => {
  it('detects Claude working status line', () => {
    expect(inferDisplayFromPreview('✽ Cooked for 12s\n❯ ')).toBe('working');
  });

  it('detects blocked permission prompt', () => {
    const text = 'Do you want to proceed?\n❯ Yes\n  No';
    expect(inferDisplayFromPreview(text)).toBe('blocked');
  });

  it('returns null for empty preview', () => {
    expect(inferDisplayFromPreview('')).toBeNull();
  });
});
