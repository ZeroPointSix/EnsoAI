const isVitest =
  process.env.VITEST === 'true' ||
  (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');

/** 看板全链路调试日志前缀（主窗 + 独立窗 renderer） */
export const SESSION_CANVAS_LOG_TAG = '[SessionCanvas]';

export type SessionCanvasLogArea =
  | 'Activity'
  | 'Monitor'
  | 'Snapshot'
  | 'Sync'
  | 'IPC'
  | 'Panel'
  | 'Card'
  | 'Drag'
  | 'Focus'
  | 'HookDisplay'
  | 'Standalone'
  | 'QuickInput'
  | 'Preview'
  | 'PtyRegistry'
  | 'App'
  | 'Resize'
  | 'PtyCheck'
  | 'Click';

export function shortSessionId(sessionId: string): string {
  return sessionId.length > 8 ? sessionId.slice(0, 8) : sessionId;
}

function formatDetail(detail?: Record<string, unknown>): string {
  if (!detail || Object.keys(detail).length === 0) return '';
  try {
    return ` ${JSON.stringify(detail)}`;
  } catch {
    return ' [detail-unserializable]';
  }
}

function writeRendererLog(line: string): void {
  console.debug(line);
  if (isVitest) return;
  void import('electron-log/renderer.js')
    .then((mod) => mod.default.debug(line))
    .catch(() => {
      // outside Electron or log transport unavailable
    });
}

/** 写入 electron-log（需 settings 开启 logging + 级别 ≥ debug）并同步 console 便于 DevTools */
export function sessionCanvasLog(
  area: SessionCanvasLogArea,
  message: string,
  detail?: Record<string, unknown>
): void {
  const line = `${SESSION_CANVAS_LOG_TAG}[${area}] ${message}${formatDetail(detail)}`;
  writeRendererLog(line);
}

export function sessionCanvasLogPhase(
  area: SessionCanvasLogArea,
  sessionId: string,
  from: string,
  to: string,
  reason: string,
  extra?: Record<string, unknown>
): void {
  sessionCanvasLog(area, `phase ${from} → ${to}`, {
    sessionId: shortSessionId(sessionId),
    reason,
    ...extra,
  });
}

const throttleLastAt = new Map<string, number>();

/** 高频路径（poll / onData）限流，避免刷屏 */
export function sessionCanvasLogThrottled(
  throttleKey: string,
  intervalMs: number,
  area: SessionCanvasLogArea,
  message: string,
  detail?: Record<string, unknown>
): void {
  const now = Date.now();
  const last = throttleLastAt.get(throttleKey) ?? 0;
  if (now - last < intervalMs) return;
  throttleLastAt.set(throttleKey, now);
  sessionCanvasLog(area, message, detail);
}
