import type {
  SessionCanvasFocusParams,
  SessionCanvasRenameParams,
  SessionCanvasSnapshot,
} from '@shared/types/sessionCanvas';
import type { ElectronAPI } from './index';

/** Explicit bridge types (avoids circular typeof inference issues). */
export type SessionCanvasPanelBridge = {
  toggle: () => Promise<boolean>;
  focusSession: (params: SessionCanvasFocusParams) => void;
  getSnapshot: () => Promise<boolean | null>;
  onSnapshotResponse: (callback: (snapshot: SessionCanvasSnapshot) => void) => (() => void);
  onSync: (callback: (snapshot: SessionCanvasSnapshot) => void) => (() => void);
  onFocusSession: (callback: (params: SessionCanvasFocusParams) => void) => (() => void);
  resetBounds: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  setCompactMode: (compact: boolean) => Promise<void>;
  getDisplayMode: () => Promise<'compact' | 'normal' | 'maximized'>;
  minimizeWindow: () => Promise<void>;
  onVisibilityChanged: (callback: (visible: boolean) => void) => (() => void);
  onGetSnapshot: (callback: () => void) => (() => void);
  sendSnapshotResponse: (snapshot: SessionCanvasSnapshot) => void;
  sendSync: (snapshot: SessionCanvasSnapshot) => void;
  renameSession: (params: SessionCanvasRenameParams) => void;
  onRenameSession: (callback: (params: SessionCanvasRenameParams) => void) => (() => void);
};

declare global {
  interface Window {
    electronAPI: Omit<ElectronAPI, 'sessionCanvasPanel'> & {
      sessionCanvasPanel: SessionCanvasPanelBridge;
    };
  }
}

export {};
