export type SessionCanvasCardKind = 'agent' | 'terminal';

export type SessionCanvasOutputState = 'idle' | 'outputting' | 'unread';

export interface SessionCanvasCardSnapshot {
  key: string;
  kind: SessionCanvasCardKind;
  sessionId: string;
  repoPath: string;
  cwd: string;
  title: string;
  previewText?: string;
  outputState?: SessionCanvasOutputState;
}

export interface SessionCanvasSnapshot {
  cards: SessionCanvasCardSnapshot[];
}

export interface SessionCanvasFocusParams {
  kind: SessionCanvasCardKind;
  sessionId: string;
  repoPath: string;
  cwd: string;
}
