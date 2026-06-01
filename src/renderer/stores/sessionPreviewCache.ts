import { getDisplayPreviewText } from '@/lib/terminalPreview';
import { mergePreviewSnapshot } from '@/lib/previewSnapshotMerge';

export type SessionPreviewKind = 'agent' | 'terminal';

const STORAGE_KEY = 'enso-session-canvas-preview-cache';

function previewKey(kind: SessionPreviewKind, sessionId: string): string {
  return `${kind}:${sessionId}`;
}

let memoryCache: Record<string, string> = {};

function loadCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function persistCache(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
  } catch {
    // ignore quota errors
  }
}

memoryCache = loadCache();

export function getCachedSessionPreview(
  kind: SessionPreviewKind,
  sessionId: string
): string | undefined {
  return memoryCache[previewKey(kind, sessionId)];
}

export function setCachedSessionPreview(
  kind: SessionPreviewKind,
  sessionId: string,
  previewText: string
): void {
  const key = previewKey(kind, sessionId);
  const trimmed = previewText.trim();
  if (!trimmed) return;
  const existing = memoryCache[key];
  const merged = mergePreviewSnapshot(existing, trimmed);
  if (!merged.trim() || merged === existing) return;
  memoryCache = { ...memoryCache, [key]: merged };
  persistCache();
}

export function removeCachedSessionPreview(kind: SessionPreviewKind, sessionId: string): void {
  const key = previewKey(kind, sessionId);
  if (!(key in memoryCache)) return;
  const { [key]: _, ...rest } = memoryCache;
  memoryCache = rest;
  persistCache();
}

/** Runtime store text + durable cache for canvas cards. */
export function getResolvedSessionPreview(
  kind: SessionPreviewKind,
  sessionId: string,
  runtimeText?: string,
  runtimePending?: string
): string | undefined {
  const runtime = getDisplayPreviewText(runtimeText, runtimePending);
  const cached = getCachedSessionPreview(kind, sessionId);
  if (runtime?.trim() && cached?.trim()) {
    return mergePreviewSnapshot(cached, runtime) || undefined;
  }
  return runtime?.trim() ? runtime : cached;
}
