import { describe, expect, it } from 'vitest';
import {
  mergeAuthoritativePreviewSnapshot,
  mergePreviewSnapshot,
  shouldApplyPreviewSnapshot,
} from '../previewSnapshotMerge';

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

describe('mergeAuthoritativePreviewSnapshot', () => {
  it('replaces long thinking text with shorter live terminal screen', () => {
    const thinking = 'L'.repeat(2000);
    const finalReply = '你好！很高兴认识你。\n\n* Cooked for 21s';
    expect(mergeAuthoritativePreviewSnapshot(thinking, finalReply)).toBe(finalReply);
  });

  it('keeps existing when incoming is empty', () => {
    expect(mergeAuthoritativePreviewSnapshot('keep', '')).toBe('keep');
  });
});
