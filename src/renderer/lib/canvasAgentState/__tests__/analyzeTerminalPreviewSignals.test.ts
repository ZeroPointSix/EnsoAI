import { describe, expect, it } from 'vitest';
import {
  detectNumberedChoiceMenu,
  detectRedAnsiInRaw,
  inferPreviewInterruptSignal,
  isClaudeIdleChrome,
} from '../analyzeTerminalPreviewSignals';

describe('analyzeTerminalPreviewSignals', () => {
  it('detects red ANSI as blocked', () => {
    const raw = 'normal\x1b[31mDo you want to allow?\x1b[0m';
    expect(detectRedAnsiInRaw(raw)).toBe(true);
    const signal = inferPreviewInterruptSignal({ rawTail: raw, strippedTail: 'Do you want to allow?' });
    expect(signal.kind).toBe('blocked');
    expect(signal.reason).toBe('ansi_red');
  });

  it('detects numbered menu 1. 2. 3.', () => {
    const text = 'Choose:\n1. Yes, allow\n2. No, deny\n3. Always allow';
    expect(detectNumberedChoiceMenu(text)).toBe(true);
    const signal = inferPreviewInterruptSignal({ strippedTail: text });
    expect(signal.kind).toBe('blocked');
    expect(signal.reason).toBe('numbered_menu');
  });

  it('detects solo digit lines 1 then 2', () => {
    const text = 'Select:\n1\n2\n3\n>';
    expect(detectNumberedChoiceMenu(text)).toBe(true);
  });

  it('detects error with red ANSI as error', () => {
    const raw = '\x1b[31mError: something failed\x1b[0m';
    const signal = inferPreviewInterruptSignal({
      rawTail: raw,
      strippedTail: 'Error: something failed',
    });
    expect(signal.kind).toBe('error');
    expect(signal.reason).toBe('ansi_red_error_text');
  });

  it('returns none for normal working output', () => {
    const signal = inferPreviewInterruptSignal({
      strippedTail: '* Crunched for 15s\n❯ ',
    });
    expect(signal.kind).toBe('none');
  });

  it('ignores Claude idle chrome footer', () => {
    const idle = '? for shortcuts · ← for agents';
    expect(isClaudeIdleChrome(idle)).toBe(true);
    const signal = inferPreviewInterruptSignal({ strippedTail: idle });
    expect(signal.kind).toBe('none');
    expect(signal.reason).toBe('none');
  });

  it('does not flag numbered pattern without menu context or red ANSI', () => {
    const text = '1. alpha\n2. beta\n3. gamma';
    expect(detectNumberedChoiceMenu(text)).toBe(true);
    const signal = inferPreviewInterruptSignal({ strippedTail: text });
    expect(signal.kind).toBe('none');
  });

  it('flags numbered menu with menu context', () => {
    const text = 'Choose:\n1. Yes\n2. No\n3. Always';
    const signal = inferPreviewInterruptSignal({ strippedTail: text });
    expect(signal.kind).toBe('blocked');
    expect(signal.reason).toBe('numbered_menu');
  });
});
