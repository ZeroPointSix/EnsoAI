import { describe, expect, it } from 'vitest';
import { resolveSessionCanvasCardPreviewText } from '../resolveSessionCanvasCardPreview';

describe('resolveSessionCanvasCardPreviewText', () => {
  const stream = 'hello\nThought for 3s\nreply body';
  const startup = "What's new\nWelcome back!\nTips for getting started";

  it('prefers IPC snapshot on standalone (no local runtime)', () => {
    expect(
      resolveSessionCanvasCardPreviewText(stream, startup, false)
    ).toBe(stream);
  });

  it('uses live runtime when embedded main window has session state', () => {
    expect(
      resolveSessionCanvasCardPreviewText(startup, stream, true)
    ).toBe(stream);
  });

  it('falls back to snapshot when live runtime empty', () => {
    expect(resolveSessionCanvasCardPreviewText(stream, undefined, true)).toBe(stream);
  });
});
