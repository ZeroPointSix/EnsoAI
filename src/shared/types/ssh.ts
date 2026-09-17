export interface SshHost {
  alias: string;
  hostName?: string;
  user?: string;
  port?: number;
}

export type SshHostDiscoveryErrorCode =
  | 'unsupported-platform'
  | 'config-not-found'
  | 'config-unreadable';

export interface SshHostDiscoveryResult {
  supported: boolean;
  hosts: SshHost[];
  configPath: string;
  errorCode?: SshHostDiscoveryErrorCode;
}

export interface SshTerminalLaunch {
  shell: string;
  args: string[];
}
