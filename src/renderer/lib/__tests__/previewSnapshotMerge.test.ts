import { describe, expect, it } from 'vitest';
import { mergeAuthoritativePreviewSnapshot } from '../previewSnapshotMerge';

describe('mergeAuthoritativePreviewSnapshot', () => {
  it('does not replace rich preview with Claude welcome screen', () => {
    const existing = 'Assistant: applying patch to SessionCanvasCard.tsx\nDone.';
    const incoming = '? for shortcuts · ← for agents\n❯ ';
    expect(mergeAuthoritativePreviewSnapshot(existing, incoming)).toBe(existing);
  });

  it('still applies meaningful incoming snapshot', () => {
    const existing = '? for shortcuts';
    const incoming = 'Build finished successfully.';
    expect(mergeAuthoritativePreviewSnapshot(existing, incoming)).toBe(incoming);
  });
});
