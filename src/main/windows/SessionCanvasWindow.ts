import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IPC_CHANNELS } from '@shared/types';
import { app, BrowserWindow } from 'electron';

let sessionCanvasWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

function teardownSessionCanvasWindow(win: BrowserWindow): void {
  try {
    if (win.isFullScreen()) {
      win.setFullScreen(false);
    }
    if (win.isMaximized()) {
      win.unmaximize();
    }
  } catch {
    // ignore teardown errors while the app is exiting
  }

  win.removeAllListeners('close');
  win.destroy();
}

const BOUNDS_FILE = join(app.getPath('userData'), 'session-canvas-window-bounds.json');

const DEFAULT_BOUNDS = {
  width: 960,
  height: 720,
  minWidth: 560,
  minHeight: 400,
};

const COMPACT_BOUNDS = {
  width: 720,
  height: 540,
};

export type SessionCanvasDisplayMode = 'compact' | 'normal' | 'maximized';

interface SessionCanvasWindowPersisted {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  displayMode?: SessionCanvasDisplayMode;
  normalBounds?: Electron.Rectangle;
}

let persistedWindowState: SessionCanvasWindowPersisted = {};

function isCompactSize(bounds: Electron.Rectangle): boolean {
  return (
    bounds.width <= COMPACT_BOUNDS.width + 8 && bounds.height <= COMPACT_BOUNDS.height + 8
  );
}

function loadWindowState(): SessionCanvasWindowPersisted {
  try {
    const fs = require('node:fs');
    if (fs.existsSync(BOUNDS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BOUNDS_FILE, 'utf-8')) as SessionCanvasWindowPersisted;
      persistedWindowState = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }
  persistedWindowState = {};
  return {};
}

function saveWindowState(patch: Partial<SessionCanvasWindowPersisted>): void {
  persistedWindowState = { ...persistedWindowState, ...patch };
  try {
    const fs = require('node:fs');
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify(persistedWindowState));
  } catch {
    // ignore
  }
}

function getPersistedDisplayMode(win: BrowserWindow): SessionCanvasDisplayMode {
  if (win.isMaximized() || win.isFullScreen()) {
    return 'maximized';
  }
  return persistedWindowState.displayMode ?? 'normal';
}

export function createSessionCanvasWindow(): BrowserWindow {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    return sessionCanvasWindow;
  }

  const saved = loadWindowState();
  const initialWidth = saved.width || DEFAULT_BOUNDS.width;
  const initialHeight = saved.height || DEFAULT_BOUNDS.height;

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: initialWidth,
    height: initialHeight,
    minWidth: DEFAULT_BOUNDS.minWidth,
    minHeight: DEFAULT_BOUNDS.minHeight,
    x: saved.x,
    y: saved.y,
    show: false,
    title: 'Session Canvas',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
    },
  };

  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.frame = true;
  } else {
    windowOptions.titleBarStyle = 'hidden';
    windowOptions.frame = false;
  }

  sessionCanvasWindow = new BrowserWindow(windowOptions);

  if (!saved.displayMode) {
    persistedWindowState.displayMode = isCompactSize({
      x: saved.x ?? 0,
      y: saved.y ?? 0,
      width: initialWidth,
      height: initialHeight,
    })
      ? 'compact'
      : 'normal';
  }

  sessionCanvasWindow.on('close', (e) => {
    e.preventDefault();
    sessionCanvasWindow!.hide();
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send(
        IPC_CHANNELS.SESSION_CANVAS_PANEL_VISIBILITY_CHANGED,
        false
      );
    }
  });

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const debouncedSaveBounds = (): void => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!sessionCanvasWindow || sessionCanvasWindow.isDestroyed()) return;
      const bounds = sessionCanvasWindow.getBounds();
      const mode = getPersistedDisplayMode(sessionCanvasWindow);

      if (mode === 'maximized') {
        saveWindowState({ displayMode: 'maximized' });
        return;
      }

      if (mode === 'compact' && !isCompactSize(bounds)) {
        persistedWindowState.displayMode = 'normal';
        persistedWindowState.normalBounds = bounds;
      } else if (mode === 'normal') {
        persistedWindowState.normalBounds = bounds;
      }

      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        displayMode: persistedWindowState.displayMode ?? mode,
        normalBounds: persistedWindowState.normalBounds,
      });
    }, 500);
  };

  sessionCanvasWindow.on('resize', debouncedSaveBounds);
  sessionCanvasWindow.on('move', debouncedSaveBounds);

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    url.pathname = '/session-canvas.html';
    sessionCanvasWindow.loadURL(url.toString());
  } else {
    sessionCanvasWindow.loadFile(join(__dirname, '../renderer/session-canvas.html'));
  }

  return sessionCanvasWindow;
}

export function showSessionCanvasWindow(): BrowserWindow {
  const win = createSessionCanvasWindow();
  win.show();
  win.focus();
  return win;
}

export function hideSessionCanvasWindow(): void {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    sessionCanvasWindow.hide();
  }
}

export function minimizeSessionCanvasWindow(): void {
  const win = sessionCanvasWindow;
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
}

export function destroySessionCanvasWindow(): void {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    teardownSessionCanvasWindow(sessionCanvasWindow);
  }
  sessionCanvasWindow = null;
}

export function getSessionCanvasWindow(): BrowserWindow | null {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    return sessionCanvasWindow;
  }
  return null;
}

export function isSessionCanvasVisible(): boolean {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    return sessionCanvasWindow.isVisible();
  }
  return false;
}

export function resetSessionCanvasWindowBounds(): void {
  const win = sessionCanvasWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMaximized()) {
    win.unmaximize();
  }
  win.setSize(DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height);
  win.center();
  const bounds = win.getBounds();
  saveWindowState({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    displayMode: 'normal',
    normalBounds: bounds,
  });
}

export function toggleSessionCanvasFullscreen(): boolean {
  const win = sessionCanvasWindow;
  if (!win || win.isDestroyed()) return false;
  if (win.isMaximized() || win.isFullScreen()) {
    if (win.isFullScreen()) win.setFullScreen(false);
    if (win.isMaximized()) win.unmaximize();
    saveWindowState({ displayMode: persistedWindowState.displayMode ?? 'normal' });
    return false;
  }
  win.maximize();
  saveWindowState({ displayMode: 'maximized' });
  return true;
}

export function setSessionCanvasCompactMode(compact: boolean): void {
  const win = sessionCanvasWindow;
  if (!win || win.isDestroyed()) return;
  if (win.isMaximized()) win.unmaximize();
  if (win.isFullScreen()) win.setFullScreen(false);

  const current = win.getBounds();

  if (compact) {
    if (getPersistedDisplayMode(win) !== 'compact') {
      persistedWindowState.normalBounds = current;
    }
    win.setSize(COMPACT_BOUNDS.width, COMPACT_BOUNDS.height);
    win.center();
    const bounds = win.getBounds();
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: COMPACT_BOUNDS.width,
      height: COMPACT_BOUNDS.height,
      displayMode: 'compact',
      normalBounds: persistedWindowState.normalBounds,
    });
    return;
  }

  const restore = persistedWindowState.normalBounds ?? {
    width: DEFAULT_BOUNDS.width,
    height: DEFAULT_BOUNDS.height,
  };
  win.setBounds({
    x: restore.x ?? current.x,
    y: restore.y ?? current.y,
    width: restore.width || DEFAULT_BOUNDS.width,
    height: restore.height || DEFAULT_BOUNDS.height,
  });
  const bounds = win.getBounds();
  saveWindowState({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    displayMode: 'normal',
    normalBounds: bounds,
  });
}

export function getSessionCanvasDisplayMode(): SessionCanvasDisplayMode {
  const win = sessionCanvasWindow;
  if (!win || win.isDestroyed()) {
    return persistedWindowState.displayMode ?? 'normal';
  }
  return getPersistedDisplayMode(win);
}

export function setSessionCanvasMainWindowRef(ref: BrowserWindow): void {
  mainWindowRef = ref;
}
