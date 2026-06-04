import { describe, expect, it } from 'vitest';
import { inferDisplayFromPreview } from '../inferDisplayFromPreview';

describe('inferDisplayFromPreview', () => {
  it('does not treat finished phase lines or idle prompt as working', () => {
    expect(inferDisplayFromPreview('✽ Cooked for 12s\n❯ ')).toBeNull();
    expect(inferDisplayFromPreview('* Crunched for 15s\nesc to interrupt\n❯ ')).toBeNull();
  });

  it('detects in-progress Claude status', () => {
    expect(inferDisplayFromPreview('✽ Bloviating…\n')).toBe('working');
    expect(inferDisplayFromPreview('⠋ Thinking…')).toBe('working');
  });

  it('detects blocked permission prompt', () => {
    const text = 'Do you want to proceed?\n❯ Yes\n  No';
    expect(inferDisplayFromPreview(text)).toBe('blocked');
  });

  it('returns null for empty preview', () => {
    expect(inferDisplayFromPreview('')).toBeNull();
  });
});
