export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
}

export interface RemoteAgentLaunchOptions {
  host: string;
  workspace: string;
  sessionName: string;
  command: string;
  outputOffset?: number;
  backend?: RemoteAgentMuxBackend;
}

export type RemoteAgentMuxBackend = 'tmux' | 'psmux';

export type RemoteAgentSessionState =
  | 'starting'
  | 'working'
  | 'waiting_input'
  | 'completed'
  | 'failed'
  | 'stopping'
  | 'stopped'
  | 'disconnected';

export type RemoteAgentErrorCode =
  | 'unsupported-platform'
  | 'config-not-found'
  | 'config-unreadable'
  | 'no-hosts'
  | 'host-not-allowed'
  | 'invalid-options'
  | 'ssh-failed'
  | 'mux-unavailable'
  | 'protocol-error';

export interface RemoteAgentError {
  code: RemoteAgentErrorCode;
  message: string;
  detail?: string;
}

export interface RemoteAgentCapability {
  backend: RemoteAgentMuxBackend;
  version?: string;
}

export interface RemoteAgentSessionStatus {
  sessionId: string;
  state: RemoteAgentSessionState;
  backend: RemoteAgentMuxBackend;
  exitCode?: number;
}

export interface RemoteAgentLogChunk {
  sessionId: string;
  data: string;
  outputOffset: number;
}

export type RemoteAgentResult<T> = { ok: true; value: T } | { ok: false; error: RemoteAgentError };

export interface TerminalCreateOptions {
  cwd?: string;
  shell?: string;
  args?: string[];
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
  shellConfig?: import('./shell').ShellConfig;
  /** Command to execute after shell is ready */
  initialCommand?: string;
  /** Concrete Host alias from the user's SSH config. */
  sshHost?: string;
  /** Remote Agent command attached to a persistent tmux session over SSH. */
  remoteAgent?: RemoteAgentLaunchOptions;
}

export interface TerminalResizeOptions {
  cols: number;
  rows: number;
}
