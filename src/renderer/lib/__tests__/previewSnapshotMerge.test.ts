import { describe, expect, it } from 'vitest';
import { mergePreviewSnapshot, shouldApplyPreviewSnapshot } from '../previewSnapshotMerge';

describe('shouldApplyPreviewSnapshot', () => {
  it('rejects empty incoming', () => {
    expect(shouldApplyPreviewSnapshot('hello', '')).toBe(false);
    expect(shouldApplyPreviewSnapshot('hello', '   ')).toBe(false);
    expect(shouldApplyPreviewSnapshot(undefined, null)).toBe(false);
  });

  it('accepts incoming when no existing', () => {
    expect(shouldApplyPreviewSnapshot(undefined, 'line one')).toBe(true);
  });

  it('rejects shorter subset of existing', () => {
    expect(shouldApplyPreviewSnapshot('long output line\nsecond line', 'short')).toBe(false);
  });

  it('accepts longer or superset incoming', () => {
    expect(shouldApplyPreviewSnapshot('short', 'long output line')).toBe(true);
    expect(shouldApplyPreviewSnapshot('part', 'partial extended')).toBe(true);
  });
});

describe('mergePreviewSnapshot', () => {
  it('keeps existing when incoming is worse', () => {
    expect(mergePreviewSnapshot('keep me', 'x')).toBe('keep me');
  });

  it('applies better incoming', () => {
    expect(mergePreviewSnapshot('old', 'new longer text')).toBe('new longer text');
  });
});
