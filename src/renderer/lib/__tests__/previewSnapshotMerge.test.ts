import { describe, expect, it } from 'vitest';
import {
  mergeAuthoritativePreviewSnapshot,
  mergeCanvasRefreshPreview,
} from '../previewSnapshotMerge';

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

describe('mergeCanvasRefreshPreview', () => {
  it('keeps streamed conversation when xterm refresh returns startup screen', () => {
    const stream =
      'hello\n你好！有什么我可以帮你的吗？\n介绍一下世界上最著名的几个编辑器\nBloviating...';
    const startup =
      "What's new\nWelcome back!\nTips for getting started\nMiniMax-M3 · API Usage Billing\nE:\\hushaokang\\apple\n>";
    expect(mergeCanvasRefreshPreview(stream, startup)).toBe(stream);
  });
});
