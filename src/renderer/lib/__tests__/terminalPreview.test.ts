import { describe, expect, it } from 'vitest';
import {
  appendTerminalPreviewChunk,
  peelIncompleteEscape,
  stripTerminalOutput,
} from '../terminalPreview';

describe('stripTerminalOutput', () => {
  it('removes CSI color codes', () => {
    expect(stripTerminalOutput('\u001b[31mhello\u001b[0m')).toBe('hello');
  });

  it('removes OSC title sequences', () => {
    expect(stripTerminalOutput('\u001b]0;title\u0007text')).toBe('text');
  });

  it('keeps the last segment after carriage return', () => {
    expect(stripTerminalOutput('old\rnew')).toBe('new');
    expect(stripTerminalOutput('line1\npartial\rfinal')).toBe('line1\nfinal');
  });
});

describe('appendTerminalPreviewChunk', () => {
  it('strips escape sequences split across chunks', () => {
    const first = appendTerminalPreviewChunk(undefined, '', 'prefix \u001b[');
    expect(first.escapePending).toBe('\u001b[');
    const second = appendTerminalPreviewChunk(first.previewText, first.escapePending, '32mok\u001b[0m');
    expect(second.previewText).toBe('prefix ok');
    expect(second.escapePending).toBe('');
  });
});

describe('peelIncompleteEscape', () => {
  it('peels trailing ESC starter', () => {
    expect(peelIncompleteEscape('text\u001b[')).toEqual({
      body: 'text',
      pending: '\u001b[',
    });
  });
});
