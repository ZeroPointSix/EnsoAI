import { describe, expect, it } from 'vitest';
import { isLowSignalCanvasPreview, resolveCanvasCardPreviewText } from '../canvasPreviewQuality';

describe('isLowSignalCanvasPreview', () => {
  it('detects Claude idle welcome hints', () => {
    expect(
      isLowSignalCanvasPreview('? for shortcuts · ← for agents\n❯ ')
    ).toBe(true);
  });

  it('keeps real agent output', () => {
    const output = 'User: fix the bug\n\nAssistant: I will read the file first.\n* Cooked for 3s';
    expect(isLowSignalCanvasPreview(output)).toBe(false);
  });
});

describe('resolveCanvasCardPreviewText', () => {
  it('prefers meaningful cache over welcome runtime', () => {
    expect(
      resolveCanvasCardPreviewText('? for shortcuts · for agents', 'Running tests...\nok 3 passed')
    ).toBe('Running tests...\nok 3 passed');
  });

  it('returns undefined when only welcome chrome exists', () => {
    expect(resolveCanvasCardPreviewText('? for shortcuts', undefined)).toBeUndefined();
  });
});
