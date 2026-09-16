import { IPC_CHANNELS, type RemoteAgentLaunchOptions, type RemoteAgentResult } from '@shared/types';
import { ipcMain } from 'electron';
import {
  RemoteAgentSessionError,
  remoteAgentSessionService,
} from '../services/ssh/RemoteAgentSessionService';
import { ptyManager } from './terminal';

async function result<T>(operation: () => Promise<T>): Promise<RemoteAgentResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof RemoteAgentSessionError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message, detail: error.detail },
      };
    }
    return {
      ok: false,
      error: {
        code: 'protocol-error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function registerRemoteAgentHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_AGENT_CAPABILITY,
    async (_, options: RemoteAgentLaunchOptions) =>
      result(() => remoteAgentSessionService.capability(options))
  );
  ipcMain.handle(IPC_CHANNELS.REMOTE_AGENT_LAUNCH, async (_, options: RemoteAgentLaunchOptions) =>
    result(() => remoteAgentSessionService.launch(options))
  );
  ipcMain.handle(IPC_CHANNELS.REMOTE_AGENT_STATUS, async (_, options: RemoteAgentLaunchOptions) =>
    result(() => remoteAgentSessionService.status(options))
  );
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_AGENT_LOGS,
    async (_, options: RemoteAgentLaunchOptions, outputOffset: number) =>
      result(() => remoteAgentSessionService.logs(options, outputOffset))
  );
  ipcMain.handle(IPC_CHANNELS.REMOTE_AGENT_DETACH, async (_, ptyId: string) => {
    ptyManager.destroy(ptyId);
    return { ok: true, value: undefined };
  });
  ipcMain.handle(IPC_CHANNELS.REMOTE_AGENT_STOP, async (_, options: RemoteAgentLaunchOptions) =>
    result(() => remoteAgentSessionService.stop(options, false))
  );
  ipcMain.handle(
    IPC_CHANNELS.REMOTE_AGENT_FORCE_STOP,
    async (_, options: RemoteAgentLaunchOptions) =>
      result(() => remoteAgentSessionService.stop(options, true))
  );
}
