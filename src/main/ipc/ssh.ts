import { IPC_CHANNELS } from '@shared/types';
import { ipcMain } from 'electron';
import { discoverSshHosts } from '../services/ssh/SshConfigService';

export function registerSshHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SSH_LIST_HOSTS, async () => {
    return discoverSshHosts();
  });
}
