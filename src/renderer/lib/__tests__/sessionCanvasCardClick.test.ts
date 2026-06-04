import { describe, expect, it } from 'vitest';
import { resolveSessionCanvasCardClickIntent } from '../sessionCanvasCardClick';

describe('resolveSessionCanvasCardClickIntent', () => {
  it('opens overlay on plain click', () => {
    expect(resolveSessionCanvasCardClickIntent({ ctrlKey: false, metaKey: false })).toBe(
      'open-overlay'
    );
  });

  it('jumps to session on Ctrl+click', () => {
    expect(resolveSessionCanvasCardClickIntent({ ctrlKey: true, metaKey: false })).toBe(
      'jump-to-session'
    );
  });

  it('jumps to session on Cmd+click (macOS)', () => {
    expect(resolveSessionCanvasCardClickIntent({ ctrlKey: false, metaKey: true })).toBe(
      'jump-to-session'
    );
  });
});
