import { describe, expect, it } from 'vitest';
import { appendTerminalPreviewChunk } from '../terminalPreview';
import { isLowSignalCanvasPreview, resolveCanvasCardPreviewText } from '../canvasPreviewQuality';
import { mergeCanvasRefreshPreview } from '../previewSnapshotMerge';

/** 模拟主窗口 Agent 终端 PTY 流式追加 + 定时 xterm 刷新 */
function simulateStreamChunks(chunks: string[]): string {
  let preview = '';
  let pending = '';
  for (const chunk of chunks) {
    const result = appendTerminalPreviewChunk(preview, pending, chunk);
    preview = result.previewText;
    pending = result.escapePending;
  }
  return preview;
}

describe('session canvas preview sync pipeline', () => {
  const xtermStartup =
    "What's new\nWelcome back!\nTips for getting started\nMiniMax-M3 · API Usage Billing\nE:\\proj\n>";

  it('keeps conversation after periodic xterm refresh returns startup screen', () => {
    const stream = simulateStreamChunks([
      'Self introduction\n',
      'Thought for 9s\n',
      'hello from Claude Code\n',
      'I can help with software engineering tasks.\n',
    ]);

    expect(stream.length).toBeGreaterThan(40);
    expect(isLowSignalCanvasPreview(stream)).toBe(false);

    const afterRefresh = mergeCanvasRefreshPreview(stream, xtermStartup);
    expect(afterRefresh).toContain('hello from Claude');
    expect(afterRefresh).not.toMatch(/what'?s new/i);
    expect(isLowSignalCanvasPreview(afterRefresh)).toBe(false);
  });

  it('displays longest good text when cache is chrome and runtime is conversation', () => {
    const runtime = simulateStreamChunks(['user: hello\n', 'assistant: hi there\n']);
    const chrome = '---------------------------------?forshortcuts...-foragents-high-/effort';

    expect(isLowSignalCanvasPreview(chrome)).toBe(true);
    const display = resolveCanvasCardPreviewText(runtime, chrome);
    expect(display).toBeTruthy();
    expect(display).toContain('assistant: hi there');
    expect(display).not.toContain('forshortcuts');
  });

  it('does not replace stream with garbled shortcut line from xterm', () => {
    const stream = simulateStreamChunks(['editor overview\n', 'Bloviating...\n']);
    const garbled = '---------------------------------?forshortcuts...-foragents-high-/effort';
    const afterRefresh = mergeCanvasRefreshPreview(stream, garbled);
    expect(afterRefresh).toContain('editor overview');
    expect(afterRefresh).not.toContain('forshortcuts');
  });

  it('accepts newer xterm output when it extends the stream', () => {
    const stream = 'hello\n';
    const newer = 'hello\nworld\n';
    const afterRefresh = mergeCanvasRefreshPreview(stream, newer);
    expect(afterRefresh).toContain('hello');
    expect(afterRefresh).toContain('world');
  });
});
