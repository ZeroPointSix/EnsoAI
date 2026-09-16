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
}

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
