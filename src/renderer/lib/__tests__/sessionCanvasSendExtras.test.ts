import { describe, expect, it } from 'vitest';
import {
  composeSessionCanvasOutgoingMessage,
  DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES,
} from '../sessionCanvasSendExtras';

describe('composeSessionCanvasOutgoingMessage', () => {
  it('prepends enabled toggle plain text and supplement before body', () => {
    const toggles = [
      {
        id: 'a',
        label: 'A',
        appendText: '规则A',
        defaultEnabled: false,
      },
    ];
    const result = composeSessionCanvasOutgoingMessage('用户主输入', {
      supplement: '补充一句',
      toggles,
      enabledById: { a: true },
    });
    expect(result).toBe('规则A\n\n补充一句\n\n用户主输入');
  });

  it('skips disabled toggles', () => {
    const result = composeSessionCanvasOutgoingMessage('only', {
      toggles: DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES,
      enabledById: Object.fromEntries(
        DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES.map((t) => [t.id, false])
      ),
    });
    expect(result).toBe('only');
  });
});
