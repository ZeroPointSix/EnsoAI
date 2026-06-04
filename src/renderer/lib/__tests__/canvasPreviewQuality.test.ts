import { describe, expect, it } from 'vitest';
import {
  isHighSignalCanvasPreview,
  isLowSignalCanvasPreview,
  resolveCanvasCardPreviewText,
} from '../canvasPreviewQuality';

describe('isLowSignalCanvasPreview', () => {
  it('detects Claude idle welcome hints', () => {
    expect(
      isLowSignalCanvasPreview('? for shortcuts · ← for agents\n❯ ')
    ).toBe(true);
  });

  it('detects Claude startup screen with Whats new', () => {
    const startup =
      "What's new\nWelcome back!\nTips for getting started\nRecent activity\nMiniMax-M3 · API Usage Billing";
    expect(isLowSignalCanvasPreview(startup)).toBe(true);
  });

  it('keeps real agent output', () => {
    const output = 'User: fix the bug\n\nAssistant: I will read the file first.\n* Cooked for 3s';
    expect(isLowSignalCanvasPreview(output)).toBe(false);
  });
});

describe('isHighSignalCanvasPreview', () => {
  it('detects Claude working / reply markers', () => {
    expect(isHighSignalCanvasPreview('Thought for 9s\nBloviating...')).toBe(true);
    expect(isHighSignalCanvasPreview('hello\n你好！有什么我可以帮你的吗？\n'.repeat(8))).toBe(true);
  });

  it('marks garbled esc+thinking tail as low signal', () => {
    expect(isLowSignalCanvasPreview('esc to interruptthinkingthinking')).toBe(true);
  });

  it('does not mark startup chrome as high signal', () => {
    const startup =
      "What's new\nWelcome back!\nTips for getting started\nMiniMax-M3 · API Usage Billing";
    expect(isHighSignalCanvasPreview(startup)).toBe(false);
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

  it('treats stripped shortcut chrome as low signal', () => {
    expect(
      isLowSignalCanvasPreview('---------------------------------?forshortcuts...-foragents-high-/effort')
    ).toBe(true);
  });

  it('prefers longer conversation over shortcut chrome', () => {
    const stream = 'Self introduction\nThought for 9s\n你好，我是 Claude';
    const chrome = '?forshortcuts...-foragents';
    expect(resolveCanvasCardPreviewText(stream, chrome)).toBe(stream);
  });
});
