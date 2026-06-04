import log from 'electron-log/main.js';

export const SESSION_CANVAS_LOG_TAG = '[SessionCanvas]';

export type SessionCanvasLogArea = 'IPC' | 'Window' | 'Hook';

function formatDetail(detail?: Record<string, unknown>): string {
  if (!detail || Object.keys(detail).length === 0) return '';
  try {
    return ` ${JSON.stringify(detail)}`;
  } catch {
    return ' [detail-unserializable]';
  }
}

export function sessionCanvasLog(
  area: SessionCanvasLogArea,
  message: string,
  detail?: Record<string, unknown>
): void {
  const line = `${SESSION_CANVAS_LOG_TAG}[${area}] ${message}${formatDetail(detail)}`;
  log.debug(line);
}
