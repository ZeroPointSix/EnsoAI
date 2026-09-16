import { execFile } from 'node:child_process';
import type {
  RemoteAgentCapability,
  RemoteAgentErrorCode,
  RemoteAgentLaunchOptions,
  RemoteAgentLogChunk,
  RemoteAgentMuxBackend,
  RemoteAgentSessionState,
  RemoteAgentSessionStatus,
  SshHostDiscoveryResult,
} from '@shared/types';
import { discoverSshHosts, getSshTerminalLaunch, isConfiguredSshHost } from './SshConfigService';

const STATUS_MARKER = '__ENSO_STATUS__';
const LOG_OFFSET_MARKER = '__ENSO_LOG_OFFSET__';
const LOG_DATA_MARKER = '__ENSO_LOG_DATA__';
const SESSION_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

interface ExecuteResult {
  stdout: string;
  stderr: string;
}

export type RemoteSshExecutor = (file: string, args: string[]) => Promise<ExecuteResult>;
export type SshDiscovery = () => Promise<SshHostDiscoveryResult>;

export class RemoteAgentSessionError extends Error {
  constructor(
    readonly code: RemoteAgentErrorCode,
    message: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = 'RemoteAgentSessionError';
  }
}

function defaultExecutor(file: string, args: string[]): Promise<ExecuteResult> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 15_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(
          new RemoteAgentSessionError('ssh-failed', 'SSH command failed', stderr || error.message)
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export function quotePosix(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function validateRemoteAgentOptions(options: RemoteAgentLaunchOptions): void {
  if (!SESSION_NAME_PATTERN.test(options.sessionName)) {
    throw new RemoteAgentSessionError('invalid-options', 'Invalid remote Agent session id');
  }
  if (
    !options.host.trim() ||
    !options.workspace.trim() ||
    !options.command.trim() ||
    /[\r\n\0]/.test(options.workspace) ||
    /[\r\n\0]/.test(options.command)
  ) {
    throw new RemoteAgentSessionError('invalid-options', 'Invalid remote Agent launch options');
  }
  if (
    options.outputOffset !== undefined &&
    (!Number.isSafeInteger(options.outputOffset) || options.outputOffset < 0)
  ) {
    throw new RemoteAgentSessionError('invalid-options', 'Invalid remote Agent output offset');
  }
}

function posixSessionDir(sessionName: string): string {
  return `"$HOME/.ensoai/sessions/${sessionName}"`;
}

function powerShellSessionDir(sessionName: string): string {
  return `(Join-Path $HOME ${quotePowerShell(`.ensoai\\sessions\\${sessionName}`)})`;
}

export function buildLaunchCommand(
  options: RemoteAgentLaunchOptions,
  backend: RemoteAgentMuxBackend
): string {
  validateRemoteAgentOptions(options);
  const { sessionName } = options;
  if (backend === 'tmux') {
    const dir = posixSessionDir(sessionName);
    const stateFile = `${dir.slice(0, -1)}/state"`;
    const exitFile = `${dir.slice(0, -1)}/exit-code"`;
    const logFile = `${dir.slice(0, -1)}/output.log"`;
    const wrapper = [
      `printf working > ${stateFile}`,
      options.command,
      'code=$?',
      `previous_state=$(cat ${stateFile} 2>/dev/null || true)`,
      `printf '%s' "$code" > ${exitFile}`,
      `if [ "$previous_state" = stopping ]; then printf stopped > ${stateFile}; elif [ "$code" -eq 0 ]; then printf completed > ${stateFile}; else printf failed > ${stateFile}; fi`,
      'exit "$code"',
    ].join('; ');
    return [
      `dir=${dir}`,
      'mkdir -p "$dir"',
      `if tmux -L enso has-session -t ${quotePosix(sessionName)} 2>/dev/null; then printf '${STATUS_MARKER}working||tmux\\n'; exit 0; fi`,
      `printf starting > ${stateFile}`,
      `: > ${logFile}`,
      `env -u TMUX tmux -L enso -f /dev/null new-session -d -s ${quotePosix(sessionName)} -c ${quotePosix(options.workspace)} sh -lc ${quotePosix(wrapper)}`,
      `tmux -L enso pipe-pane -o -t ${quotePosix(sessionName)} ${quotePosix(`cat >> ${logFile}`)}`,
      `printf '${STATUS_MARKER}starting||tmux\\n'`,
    ].join('; ');
  }

  const dir = powerShellSessionDir(sessionName);
  const stateFile = `(Join-Path ${dir} 'state')`;
  const exitFile = `(Join-Path ${dir} 'exit-code')`;
  const logFile = `(Join-Path ${dir} 'output.log')`;
  const wrapper = [
    `Set-Location -LiteralPath ${quotePowerShell(options.workspace)}`,
    `Set-Content -LiteralPath ${stateFile} -Value working -NoNewline`,
    `$script = [ScriptBlock]::Create(${quotePowerShell(options.command)})`,
    `& $script 2>&1 | Tee-Object -FilePath ${logFile} -Append`,
    '$code = $LASTEXITCODE',
    `$previousState = if (Test-Path ${stateFile}) { Get-Content ${stateFile} -Raw } else { '' }`,
    `Set-Content -LiteralPath ${exitFile} -Value $code -NoNewline`,
    `Set-Content -LiteralPath ${stateFile} -Value $(if ($previousState -eq 'stopping') { 'stopped' } elseif ($code -eq 0) { 'completed' } else { 'failed' }) -NoNewline`,
    'exit $code',
  ].join('; ');
  return [
    `$dir = ${dir}`,
    'New-Item -ItemType Directory -Force -Path $dir | Out-Null',
    `& psmux -L enso has-session -t ${quotePowerShell(sessionName)} 2>$null`,
    `if ($LASTEXITCODE -eq 0) { Write-Output '${STATUS_MARKER}working||psmux'; exit 0 }`,
    `Set-Content -LiteralPath ${stateFile} -Value starting -NoNewline`,
    `Set-Content -LiteralPath ${logFile} -Value '' -NoNewline`,
    `& psmux -L enso new-session -d -s ${quotePowerShell(sessionName)} powershell -NoProfile -Command ${quotePowerShell(wrapper)}`,
    `Write-Output '${STATUS_MARKER}starting||psmux'`,
  ].join('; ');
}

export function buildStatusCommand(sessionName: string, backend: RemoteAgentMuxBackend): string {
  if (!SESSION_NAME_PATTERN.test(sessionName)) {
    throw new RemoteAgentSessionError('invalid-options', 'Invalid remote Agent session id');
  }
  if (backend === 'tmux') {
    const dir = posixSessionDir(sessionName);
    return [
      `state=$(cat ${dir.slice(0, -1)}/state" 2>/dev/null || printf disconnected)`,
      `exit_code=$(cat ${dir.slice(0, -1)}/exit-code" 2>/dev/null || true)`,
      `if tmux -L enso has-session -t ${quotePosix(sessionName)} 2>/dev/null && { [ "$state" = starting ] || [ "$state" = disconnected ]; }; then state=working; fi`,
      `printf '${STATUS_MARKER}%s|%s|tmux\\n' "$state" "$exit_code"`,
    ].join('; ');
  }
  const dir = powerShellSessionDir(sessionName);
  return [
    `$statePath = Join-Path ${dir} 'state'`,
    `$exitPath = Join-Path ${dir} 'exit-code'`,
    `$state = if (Test-Path $statePath) { Get-Content $statePath -Raw } else { 'disconnected' }`,
    `$exitCode = if (Test-Path $exitPath) { Get-Content $exitPath -Raw } else { '' }`,
    `& psmux -L enso has-session -t ${quotePowerShell(sessionName)} 2>$null`,
    `if ($LASTEXITCODE -eq 0 -and ($state -eq 'starting' -or $state -eq 'disconnected')) { $state = 'working' }`,
    `Write-Output ("${STATUS_MARKER}{0}|{1}|psmux" -f $state,$exitCode)`,
  ].join('; ');
}

export function buildLogsCommand(
  sessionName: string,
  backend: RemoteAgentMuxBackend,
  outputOffset: number
): string {
  if (
    !SESSION_NAME_PATTERN.test(sessionName) ||
    !Number.isSafeInteger(outputOffset) ||
    outputOffset < 0
  ) {
    throw new RemoteAgentSessionError('invalid-options', 'Invalid remote Agent log request');
  }
  if (backend === 'tmux') {
    const logFile = `${posixSessionDir(sessionName).slice(0, -1)}/output.log"`;
    return [
      `log=${logFile}`,
      'size=$(wc -c < "$log" 2>/dev/null || printf 0)',
      `printf '${LOG_OFFSET_MARKER}%s\\n' "$size"`,
      `printf '${LOG_DATA_MARKER}'`,
      `if [ "$size" -gt ${outputOffset} ]; then dd if="$log" bs=1 skip=${outputOffset} 2>/dev/null | base64 | tr -d '\\r\\n'; fi`,
      "printf '\\n'",
    ].join('; ');
  }
  const logFile = `(Join-Path ${powerShellSessionDir(sessionName)} 'output.log')`;
  return [
    `$path = ${logFile}`,
    '$bytes = if (Test-Path $path) { [IO.File]::ReadAllBytes($path) } else { [byte[]]@() }',
    `Write-Output ("${LOG_OFFSET_MARKER}{0}" -f $bytes.Length)`,
    `$slice = if ($bytes.Length -gt ${outputOffset}) { $bytes[${outputOffset}..($bytes.Length - 1)] } else { [byte[]]@() }`,
    `Write-Output ("${LOG_DATA_MARKER}{0}" -f [Convert]::ToBase64String($slice))`,
  ].join('; ');
}

export function buildStopCommand(
  sessionName: string,
  backend: RemoteAgentMuxBackend,
  force: boolean
): string {
  if (!SESSION_NAME_PATTERN.test(sessionName)) {
    throw new RemoteAgentSessionError('invalid-options', 'Invalid remote Agent session id');
  }
  const mux = backend;
  if (backend === 'tmux') {
    const dir = posixSessionDir(sessionName);
    const stateFile = `${dir.slice(0, -1)}/state"`;
    const exitFile = `${dir.slice(0, -1)}/exit-code"`;
    return force
      ? `${mux} -L enso kill-session -t ${quotePosix(sessionName)}; printf stopped > ${stateFile}; printf 137 > ${exitFile}`
      : `printf stopping > ${stateFile}; ${mux} -L enso send-keys -t ${quotePosix(sessionName)} C-c`;
  }
  const dir = powerShellSessionDir(sessionName);
  const stateFile = `(Join-Path ${dir} 'state')`;
  const exitFile = `(Join-Path ${dir} 'exit-code')`;
  return force
    ? `& psmux -L enso kill-session -t ${quotePowerShell(sessionName)}; Set-Content ${stateFile} stopped -NoNewline; Set-Content ${exitFile} 137 -NoNewline`
    : `Set-Content ${stateFile} stopping -NoNewline; & psmux -L enso send-keys -t ${quotePowerShell(sessionName)} C-c`;
}

function parseStatus(
  stdout: string,
  fallbackBackend: RemoteAgentMuxBackend
): RemoteAgentSessionStatus {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith(STATUS_MARKER));
  if (!line) {
    throw new RemoteAgentSessionError('protocol-error', 'Remote Agent returned an invalid status');
  }
  const [stateValue, exitValue, backendValue] = line.slice(STATUS_MARKER.length).split('|');
  const allowedStates: RemoteAgentSessionState[] = [
    'starting',
    'working',
    'waiting_input',
    'completed',
    'failed',
    'stopping',
    'stopped',
    'disconnected',
  ];
  const state = allowedStates.includes(stateValue as RemoteAgentSessionState)
    ? (stateValue as RemoteAgentSessionState)
    : 'disconnected';
  const parsedExit = exitValue === '' ? undefined : Number.parseInt(exitValue, 10);
  const backend = backendValue === 'psmux' ? 'psmux' : fallbackBackend;
  return {
    sessionId: '',
    state,
    backend,
    ...(Number.isFinite(parsedExit) ? { exitCode: parsedExit } : {}),
  };
}

export class RemoteAgentSessionService {
  private readonly backendCache = new Map<string, RemoteAgentCapability>();

  constructor(
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly executor: RemoteSshExecutor = defaultExecutor,
    private readonly discovery: SshDiscovery = () => discoverSshHosts()
  ) {}

  private async ensureHost(host: string): Promise<void> {
    if (this.platform !== 'win32') {
      throw new RemoteAgentSessionError(
        'unsupported-platform',
        'Remote SSH Agents are only supported on Windows'
      );
    }
    const result = await this.discovery();
    if (!result.supported) {
      throw new RemoteAgentSessionError(
        'unsupported-platform',
        'Remote SSH Agents are only supported on Windows'
      );
    }
    if (result.errorCode === 'config-not-found') {
      throw new RemoteAgentSessionError('config-not-found', 'OpenSSH config was not found');
    }
    if (result.errorCode === 'config-unreadable') {
      throw new RemoteAgentSessionError('config-unreadable', 'OpenSSH config could not be read');
    }
    if (result.hosts.length === 0) {
      throw new RemoteAgentSessionError(
        'no-hosts',
        'OpenSSH config contains no concrete Host aliases'
      );
    }
    if (!isConfiguredSshHost(result, host)) {
      throw new RemoteAgentSessionError(
        'host-not-allowed',
        'SSH host is not present in the local OpenSSH config'
      );
    }
    getSshTerminalLaunch(host, this.platform);
  }

  private async run(host: string, remoteCommand: string): Promise<ExecuteResult> {
    await this.ensureHost(host);
    try {
      return await this.executor('ssh.exe', ['-T', '--', host.trim(), remoteCommand]);
    } catch (error) {
      if (error instanceof RemoteAgentSessionError) throw error;
      throw new RemoteAgentSessionError(
        'ssh-failed',
        'SSH command failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async capability(
    options: Pick<RemoteAgentLaunchOptions, 'host'>
  ): Promise<RemoteAgentCapability> {
    const host = options.host.trim();
    const cached = this.backendCache.get(host.toLocaleLowerCase());
    if (cached) return cached;
    for (const backend of ['tmux', 'psmux'] as const) {
      try {
        const result = await this.run(host, `${backend} -V`);
        const capability = { backend, version: result.stdout.trim() || undefined };
        this.backendCache.set(host.toLocaleLowerCase(), capability);
        return capability;
      } catch (error) {
        if (!(error instanceof RemoteAgentSessionError) || error.code !== 'ssh-failed') {
          throw error;
        }
        const failure = `${error.message} ${error.detail ?? ''}`;
        if (
          !/(command not found|not recognized|is not recognized|not found|exit code 127)/i.test(
            failure
          )
        ) {
          throw error;
        }
      }
    }
    throw new RemoteAgentSessionError(
      'mux-unavailable',
      'The remote host must provide tmux or psmux before an Agent can be launched'
    );
  }

  async launch(options: RemoteAgentLaunchOptions): Promise<RemoteAgentSessionStatus> {
    validateRemoteAgentOptions(options);
    const capability = options.backend
      ? { backend: options.backend }
      : await this.capability(options);
    const result = await this.run(options.host, buildLaunchCommand(options, capability.backend));
    return { ...parseStatus(result.stdout, capability.backend), sessionId: options.sessionName };
  }

  async status(options: RemoteAgentLaunchOptions): Promise<RemoteAgentSessionStatus> {
    validateRemoteAgentOptions(options);
    const capability = options.backend
      ? { backend: options.backend }
      : await this.capability(options);
    const result = await this.run(
      options.host,
      buildStatusCommand(options.sessionName, capability.backend)
    );
    return { ...parseStatus(result.stdout, capability.backend), sessionId: options.sessionName };
  }

  async logs(options: RemoteAgentLaunchOptions, outputOffset = 0): Promise<RemoteAgentLogChunk> {
    validateRemoteAgentOptions({ ...options, outputOffset });
    const capability = options.backend
      ? { backend: options.backend }
      : await this.capability(options);
    const result = await this.run(
      options.host,
      buildLogsCommand(options.sessionName, capability.backend, outputOffset)
    );
    const offsetLine = result.stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith(LOG_OFFSET_MARKER));
    const dataLine = result.stdout.split(/\r?\n/).find((line) => line.startsWith(LOG_DATA_MARKER));
    if (!offsetLine || !dataLine) {
      throw new RemoteAgentSessionError(
        'protocol-error',
        'Remote Agent returned an invalid log chunk'
      );
    }
    const nextOffset = Number.parseInt(offsetLine.slice(LOG_OFFSET_MARKER.length), 10);
    if (!Number.isSafeInteger(nextOffset) || nextOffset < outputOffset) {
      throw new RemoteAgentSessionError(
        'protocol-error',
        'Remote Agent returned an invalid log offset'
      );
    }
    return {
      sessionId: options.sessionName,
      outputOffset: nextOffset,
      data: Buffer.from(dataLine.slice(LOG_DATA_MARKER.length), 'base64').toString('utf8'),
    };
  }

  async stop(options: RemoteAgentLaunchOptions, force = false): Promise<RemoteAgentSessionStatus> {
    validateRemoteAgentOptions(options);
    const capability = options.backend
      ? { backend: options.backend }
      : await this.capability(options);
    await this.run(options.host, buildStopCommand(options.sessionName, capability.backend, force));
    return await this.status({ ...options, backend: capability.backend });
  }
}

export const remoteAgentSessionService = new RemoteAgentSessionService();
