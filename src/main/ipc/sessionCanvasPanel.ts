import type {
  SessionCanvasFocusParams,
  SessionCanvasRenameParams,
  SessionCanvasSnapshot,
} from '@shared/types/sessionCanvas';
import { IPC_CHANNELS } from '@shared/types';
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import {
  getSessionCanvasWindow,
  hideSessionCanvasWindow,
  isSessionCanvasVisible,
  getSessionCanvasDisplayMode,
  resetSessionCanvasWindowBounds,
  setSessionCanvasCompactMode,
  setSessionCanvasMainWindowRef,
  showSessionCanvasWindow,
  toggleSessionCanvasFullscreen,
} from '../windows/SessionCanvasWindow';

export function registerSessionCanvasPanelHandlers(mainWindow: BrowserWindow): void {
  setSessionCanvasMainWindowRef(mainWindow);

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_PANEL_TOGGLE, () => {
    if (isSessionCanvasVisible()) {
      hideSessionCanvasWindow();
    } else {
      showSessionCanvasWindow();
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_GET_SNAPSHOT);
      }
    }
    const visible = isSessionCanvasVisible();
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_PANEL_VISIBILITY_CHANGED, visible);
    }
    return visible;
  });

  ipcMain.on(
    IPC_CHANNELS.SESSION_CANVAS_FOCUS_SESSION,
    (_event, params: SessionCanvasFocusParams) => {
      if (!mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
        mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_FOCUS_SESSION, params);
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_GET_SNAPSHOT, () => {
    if (mainWindow.isDestroyed()) return null;
    mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_GET_SNAPSHOT);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_PANEL_RESET_BOUNDS, () => {
    resetSessionCanvasWindowBounds();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_TOGGLE_FULLSCREEN, () => {
    return toggleSessionCanvasFullscreen();
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_SET_COMPACT, (_event, compact: boolean) => {
    setSessionCanvasCompactMode(Boolean(compact));
  });

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_GET_DISPLAY_MODE, () => {
    return getSessionCanvasDisplayMode();
  });

  ipcMain.on(
    IPC_CHANNELS.SESSION_CANVAS_SNAPSHOT_RESPONSE,
    (_event, snapshot: SessionCanvasSnapshot) => {
      const panelWindow = getSessionCanvasWindow();
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_SNAPSHOT_RESPONSE, snapshot);
      }
    }
  );

  ipcMain.on(IPC_CHANNELS.SESSION_CANVAS_SYNC, (_event, snapshot: SessionCanvasSnapshot) => {
    const panelWindow = getSessionCanvasWindow();
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_SYNC, snapshot);
    }
  });

  ipcMain.on(
    IPC_CHANNELS.SESSION_CANVAS_RENAME_SESSION,
    (_event, params: SessionCanvasRenameParams) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_RENAME_SESSION, params);
      }
    }
  );
}
