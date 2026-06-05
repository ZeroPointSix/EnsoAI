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
  minimizeSessionCanvasWindow,
  resetSessionCanvasWindowBounds,
  setSessionCanvasCompactMode,
  setSessionCanvasMainWindowRef,
  showSessionCanvasWindow,
  toggleSessionCanvasFullscreen,
} from '../windows/SessionCanvasWindow';
import { sessionCanvasLog } from '../utils/sessionCanvasLog';

interface SessionCanvasArmCpuWakeParams {
  requestId: string;
  sessionId: string;
  reason: string;
}

interface SessionCanvasArmCpuWakeAck {
  requestId: string;
  sessionId: string;
}

export function registerSessionCanvasPanelHandlers(mainWindow: BrowserWindow): void {
  setSessionCanvasMainWindowRef(mainWindow);
  sessionCanvasLog('IPC', 'registerSessionCanvasPanelHandlers');

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_PANEL_TOGGLE, () => {
    if (isSessionCanvasVisible()) {
      sessionCanvasLog('IPC', 'toggle → hide');
      hideSessionCanvasWindow();
    } else {
      sessionCanvasLog('IPC', 'toggle → show');
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
      sessionCanvasLog('IPC', 'focusSession → main', {
        kind: params.kind,
        sessionId: params.sessionId?.slice(0, 8),
        cwd: params.cwd,
      });
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
    sessionCanvasLog('IPC', 'getSnapshot → forward to main renderer');
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

  ipcMain.handle(IPC_CHANNELS.SESSION_CANVAS_WINDOW_MINIMIZE, () => {
    minimizeSessionCanvasWindow();
  });

  ipcMain.on(
    IPC_CHANNELS.SESSION_CANVAS_SNAPSHOT_RESPONSE,
    (_event, snapshot: SessionCanvasSnapshot) => {
      sessionCanvasLog('IPC', 'snapshotResponse → standalone', {
        cardCount: snapshot?.cards?.length ?? 0,
      });
      const panelWindow = getSessionCanvasWindow();
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_SNAPSHOT_RESPONSE, snapshot);
      }
    }
  );

  ipcMain.on(IPC_CHANNELS.SESSION_CANVAS_SYNC, (_event, snapshot: SessionCanvasSnapshot) => {
    sessionCanvasLog('IPC', 'sync → standalone', { cardCount: snapshot?.cards?.length ?? 0 });
    const panelWindow = getSessionCanvasWindow();
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_SYNC, snapshot);
    }
  });

  ipcMain.on(
    IPC_CHANNELS.SESSION_CANVAS_RENAME_SESSION,
    (_event, params: SessionCanvasRenameParams) => {
      sessionCanvasLog('IPC', 'renameSession → main', {
        kind: params.kind,
        sessionId: params.sessionId?.slice(0, 8),
        title: params.title,
      });
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_RENAME_SESSION, params);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SESSION_CANVAS_RELAY_ARM_CPU_WAKE,
    async (_event, params: SessionCanvasArmCpuWakeParams) => {
      sessionCanvasLog('IPC', 'relayArmCpuWake → main', {
        requestId: params.requestId,
        sessionId: params.sessionId?.slice(0, 8),
        reason: params.reason,
      });

      if (mainWindow.isDestroyed()) return false;

      return await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          ipcMain.off(IPC_CHANNELS.SESSION_CANVAS_ARM_CPU_WAKE_ACK, onAck);
          sessionCanvasLog('IPC', 'relayArmCpuWake ack timeout', {
            requestId: params.requestId,
            sessionId: params.sessionId?.slice(0, 8),
          });
          resolve(false);
        }, 2000);

        const onAck = (_ackEvent: Electron.IpcMainEvent, ack: SessionCanvasArmCpuWakeAck) => {
          if (ack.requestId !== params.requestId) return;
          clearTimeout(timeout);
          ipcMain.off(IPC_CHANNELS.SESSION_CANVAS_ARM_CPU_WAKE_ACK, onAck);
          sessionCanvasLog('IPC', 'relayArmCpuWake acked', {
            requestId: ack.requestId,
            sessionId: ack.sessionId?.slice(0, 8),
          });
          resolve(true);
        };

        ipcMain.on(IPC_CHANNELS.SESSION_CANVAS_ARM_CPU_WAKE_ACK, onAck);
        mainWindow.webContents.send(IPC_CHANNELS.SESSION_CANVAS_APPLY_ARM_CPU_WAKE, params);
      });
    }
  );
}
