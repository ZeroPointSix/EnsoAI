import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IPC_CHANNELS } from '@shared/types';
import { app, BrowserWindow } from 'electron';

let sessionCanvasWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;

const BOUNDS_FILE = join(app.getPath('userData'), 'session-canvas-window-bounds.json');

const DEFAULT_BOUNDS = {
  width: 960,
  height: 720,
  minWidth: 560,
  minHeight: 400,
};

function loadBounds(): Partial<Electron.Rectangle> {
  try {
    const fs = require('node:fs');
    if (fs.existsSync(BOUNDS_FILE)) {
      return JSON.parse(fs.readFileSync(BOUNDS_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

function saveBounds(bounds: Partial<Electron.Rectangle>): void {
  try {
    const fs = require('node:fs');
    fs.writeFileSync(BOUNDS_FILE, JSON.stringify(bounds));
  } catch {
    // ignore
  }
}

export function createSessionCanvasWindow(): BrowserWindow {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    return sessionCanvasWindow;
  }

  const savedBounds = loadBounds();

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: savedBounds.width || DEFAULT_BOUNDS.width,
    height: savedBounds.height || DEFAULT_BOUNDS.height,
    minWidth: DEFAULT_BOUNDS.minWidth,
    minHeight: DEFAULT_BOUNDS.minHeight,
    x: savedBounds.x,
    y: savedBounds.y,
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
      if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
        saveBounds(sessionCanvasWindow.getBounds());
      }
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

export function destroySessionCanvasWindow(): void {
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    sessionCanvasWindow.removeAllListeners('close');
    sessionCanvasWindow.close();
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
  if (sessionCanvasWindow && !sessionCanvasWindow.isDestroyed()) {
    sessionCanvasWindow.setSize(DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height);
    sessionCanvasWindow.center();
  }
}

export function setSessionCanvasMainWindowRef(ref: BrowserWindow): void {
  mainWindowRef = ref;
}
