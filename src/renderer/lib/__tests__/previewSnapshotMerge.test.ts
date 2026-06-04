import { describe, expect, it } from 'vitest';
import {
  mergeAuthoritativePreviewSnapshot,
  mergeCanvasRefreshPreview,
  mergeXtermCanvasPreview,
  shouldApplyPreviewSnapshot,
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

describe('shouldApplyPreviewSnapshot', () => {
  it('rejects shorter subset refresh', () => {
    expect(shouldApplyPreviewSnapshot('long conversation tail here', 'short')).toBe(false);
  });

  it('accepts incoming that extends existing', () => {
    expect(shouldApplyPreviewSnapshot('hello', 'hello\nworld')).toBe(true);
  });
});

describe('mergeXtermCanvasPreview', () => {
  it('replaces garbled PTY stream with meaningful xterm screen', () => {
    const garbled = 'esc to interruptthinkingthinking';
    const screen =
      '介绍一下世界第一美丽的人\nThought for 6s\n奥黛丽·赫本、费雯·丽…\n* Crunched for 15s\n';
    expect(mergeXtermCanvasPreview(garbled, screen)).toBe(screen);
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

  it('returns incoming when existing is empty', () => {
    expect(mergeCanvasRefreshPreview('', 'new line')).toBe('new line');
  });

  it('returns existing when incoming is empty', () => {
    expect(mergeCanvasRefreshPreview('keep me', '')).toBe('keep me');
  });

  it('replaces chrome-only existing with real snapshot', () => {
    const chrome = '? for shortcuts · for agents';
    const real = 'Self introduction\nThought for 9s\nDone.';
    expect(mergeCanvasRefreshPreview(chrome, real)).toBe(real);
  });

  it('keeps longer stream when incoming is shorter unrelated xterm slice', () => {
    const stream = 'A'.repeat(200) + '\nuser asked about editors\nBloviating...';
    const short = 'Welcome back!\n>';
    expect(mergeCanvasRefreshPreview(stream, short)).toBe(stream);
  });

  it('never replaces high-signal stream with startup xterm snapshot', () => {
    const stream =
      'Self introduction\nThought for 9s\nhello from Claude\nI can help with software tasks.\n';
    const startup =
      "What's new\nWelcome back!\nTips for getting started\nMiniMax-M3 · API Usage Billing\n>";
    expect(mergeCanvasRefreshPreview(stream, startup)).toBe(stream);
  });
});
