import { describe, expect, it } from 'vitest';
import { inferBlockedFromPreview, inferDisplayFromPreview } from '../inferDisplayFromPreview';

describe('inferBlockedFromPreview', () => {
  it('detects blocked permission prompt', () => {
    const text = 'Do you want to proceed?\n❯ Yes\n  No';
    expect(inferBlockedFromPreview(text)).toBe(true);
  });

  it('does not treat finished Claude lines as blocked or working', () => {
    expect(inferBlockedFromPreview('* Crunched for 15s\n❯ ')).toBe(false);
    expect(inferDisplayFromPreview('✽ Bloviating…\n')).toBeNull();
  });

  it('returns null for empty preview', () => {
    expect(inferDisplayFromPreview('')).toBeNull();
  });
});
