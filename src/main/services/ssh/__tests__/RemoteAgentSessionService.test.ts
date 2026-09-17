import type { RemoteAgentLaunchOptions, SshHostDiscoveryResult } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLaunchCommand,
  buildLogsCommand,
  buildStatusCommand,
  buildStopCommand,
  classifySshError,
  REMOTE_LOG_CHUNK_BYTES,
  RemoteAgentSessionError,
  RemoteAgentSessionService,
  wrapRemoteAgentCommand,
} from '../RemoteAgentSessionService';

const options: RemoteAgentLaunchOptions = {
  host: 'build-box',
  workspace: '~/workspace/project',
  sessionName: 'enso-session_123',
  command: 'claude --session-id abc',
};

const discovery: SshHostDiscoveryResult = {
  supported: true,
  configPath: 'C:\\Users\\test\\.ssh\\config',
  hosts: [{ alias: 'build-box', hostName: 'example.test' }],
};

describe('RemoteAgentSessionService', () => {
  it('rejects non-Windows callers before invoking SSH', async () => {
    const executor = vi.fn();
    const service = new RemoteAgentSessionService('linux', executor, async () => discovery);
    await expect(service.capability(options)).rejects.toMatchObject({
      code: 'unsupported-platform',
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it('rejects hosts outside the current OpenSSH allowlist', async () => {
    const service = new RemoteAgentSessionService('win32', vi.fn(), async () => discovery);
    await expect(service.capability({ host: 'other-box' })).rejects.toMatchObject({
      code: 'host-not-allowed',
    });
  });

  it('detects tmux before launch and creates a journaled stable session', async () => {
    const calls: string[][] = [];
    const executor = vi.fn(async (_file: string, args: string[]) => {
      calls.push(args);
      if (args.at(-1) === 'tmux -V') return { stdout: 'tmux 3.4', stderr: '' };
      return { stdout: '__ENSO_STATUS__starting||tmux\n', stderr: '' };
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);
    const status = await service.launch(options);
    expect(status).toEqual({
      sessionId: options.sessionName,
      state: 'starting',
      backend: 'tmux',
    });
    expect(calls[1].slice(0, 4)).toEqual(['-T', '--', 'build-box', calls[1][3]]);
    expect(calls[1][3]).toContain('.ensoai/sessions/enso-session_123');
    expect(calls[1][3]).toContain('pipe-pane');
    expect(calls[1][3]).toContain('new-session -d');
    expect(calls[1][3]).toContain('respawn-pane -k');
    expect(calls[1][3].indexOf('pipe-pane')).toBeLessThan(calls[1][3].indexOf('respawn-pane -k'));
    expect(calls[1][3]).toContain('if [ -f "$HOME/.ensoai/sessions/enso-session_123/state" ]');
    expect(calls[1][3]).toContain('workspace="$HOME/$' + '{workspace#~/}"');
    expect(calls[1][3]).toContain('-c "$workspace"');
    const psmuxLaunch = buildLaunchCommand(options, 'psmux');
    expect(psmuxLaunch).toContain('if (Test-Path');
    expect(psmuxLaunch).toContain('$LASTEXITCODE -ne 0');
    expect(psmuxLaunch).toContain('new-session -d');
    expect(psmuxLaunch).toContain('pipe-pane -o');
    expect(psmuxLaunch).toContain('respawn-pane -k');
    expect(psmuxLaunch.indexOf('pipe-pane -o')).toBeLessThan(
      psmuxLaunch.indexOf('respawn-pane -k')
    );
    expect(psmuxLaunch).not.toContain('Tee-Object');
  });

  it('returns only bytes after output_offset and advances the stable offset', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      if (args.at(-1) === 'tmux -V') return { stdout: 'tmux 3.4', stderr: '' };
      return {
        stdout: `__ENSO_LOG_OFFSET__11\n__ENSO_LOG_DATA__${Buffer.from('world').toString('base64')}\n`,
        stderr: '',
      };
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);
    await expect(service.logs(options, 6)).resolves.toEqual({
      sessionId: options.sessionName,
      data: 'world',
      outputOffset: 11,
    });
    const command = executor.mock.calls.at(-1)?.[1].at(-1);
    expect(command).toContain('skip=6');
    expect(command).toContain('count="$count"');
    expect(command).toContain(`if [ "$count" -gt ${REMOTE_LOG_CHUNK_BYTES} ]`);
    expect(command).toContain('end=$((6 + count))');
  });

  it('does not advance output_offset across a partial UTF-8 character', async () => {
    const character = Buffer.from('你');
    let logRead = 0;
    const executor = vi.fn(async (_file: string, args: string[]) => {
      if (args.at(-1) === 'tmux -V') return { stdout: 'tmux 3.4', stderr: '' };
      logRead += 1;
      const bytes = logRead === 1 ? character.subarray(0, 2) : character;
      return {
        stdout: `__ENSO_LOG_OFFSET__${bytes.length}\n__ENSO_LOG_DATA__${bytes.toString('base64')}\n`,
        stderr: '',
      };
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);

    await expect(service.logs(options, 0)).resolves.toEqual({
      sessionId: options.sessionName,
      data: '',
      outputOffset: 0,
    });
    await expect(service.logs(options, 0)).resolves.toEqual({
      sessionId: options.sessionName,
      data: '你',
      outputOffset: 3,
    });
  });

  it('returns the authoritative remote state and exit code', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      if (args.at(-1) === 'tmux -V') return { stdout: 'tmux 3.4', stderr: '' };
      return { stdout: '__ENSO_STATUS__failed|23|tmux\\n', stderr: '' };
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);
    await expect(service.status(options)).resolves.toEqual({
      sessionId: options.sessionName,
      state: 'failed',
      backend: 'tmux',
      exitCode: 23,
    });
  });

  it('distinguishes graceful stop from force-stop and preserves stopping state', () => {
    expect(buildStopCommand(options.sessionName, 'tmux', false)).toContain('send-keys');
    expect(buildStopCommand(options.sessionName, 'tmux', false)).toContain('stopping');
    expect(buildStopCommand(options.sessionName, 'tmux', false)).not.toContain('kill-session');
    const tmuxForceStop = buildStopCommand(options.sessionName, 'tmux', true);
    const psmuxForceStop = buildStopCommand(options.sessionName, 'psmux', true);
    expect(tmuxForceStop).toContain('kill-session');
    expect(tmuxForceStop).toContain('|| exit $?');
    expect(tmuxForceStop).toContain('137');
    expect(psmuxForceStop).toContain('$LASTEXITCODE -ne 0');
    expect(psmuxForceStop).toContain('137');
    expect(buildLaunchCommand(options, 'tmux')).toContain('previous_state');
    expect(buildLaunchCommand(options, 'tmux')).toContain('trap');
    expect(buildLaunchCommand(options, 'tmux')).toContain('printf 130');
    expect(buildLaunchCommand(options, 'tmux')).toContain('printf stopped');
    const tmuxStatus = buildStatusCommand(options.sessionName, 'tmux');
    const psmuxStatus = buildStatusCommand(options.sessionName, 'psmux');
    expect(tmuxStatus).toContain('has_session=0');
    expect(tmuxStatus).toContain('state=disconnected');
    expect(psmuxStatus).toContain('$hasSession = $LASTEXITCODE -eq 0');
    expect(psmuxStatus).toContain("$state = 'disconnected'");
  });

  it('fails explicitly when neither tmux nor psmux is available', async () => {
    const executor = vi.fn(async () => {
      throw new RemoteAgentSessionError('ssh-failed', 'not found');
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);
    await expect(service.capability(options)).rejects.toMatchObject({ code: 'mux-unavailable' });
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('rejects psmux versions without the required pipe-pane and Ctrl-C fixes', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      if (args.at(-1) === 'tmux -V') {
        throw new RemoteAgentSessionError('ssh-failed', 'not found');
      }
      return { stdout: 'psmux 3.3.2', stderr: '' };
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);

    await expect(service.capability(options)).rejects.toMatchObject({
      code: 'mux-unavailable',
      message: expect.stringContaining('3.3.8'),
      detail: 'Detected psmux 3.3.2',
    });
  });

  it('accepts a psmux version with the required lifecycle fixes', async () => {
    const executor = vi.fn(async (_file: string, args: string[]) => {
      if (args.at(-1) === 'tmux -V') {
        throw new RemoteAgentSessionError('ssh-failed', 'not found');
      }
      return { stdout: 'psmux 3.3.8', stderr: '' };
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);

    await expect(service.capability(options)).resolves.toEqual({
      backend: 'psmux',
      version: 'psmux 3.3.8',
    });
  });

  it('preserves SSH transport errors instead of reporting a missing multiplexer', async () => {
    const executor = vi.fn(async () => {
      throw new RemoteAgentSessionError('ssh-failed', 'SSH command failed', 'Connection timed out');
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);
    await expect(service.capability(options)).rejects.toMatchObject({
      code: 'ssh-failed',
      detail: 'Connection timed out',
    });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('classifies actionable SSH transport failures', () => {
    expect(classifySshError('Permission denied (publickey)')).toBe('auth-failed');
    expect(classifySshError('Host key verification failed')).toBe('host-key-failed');
    expect(classifySshError('ssh: connect to host example port 22: Connection timed out')).toBe(
      'host-unreachable'
    );
  });

  it('runs psmux lifecycle scripts through an explicit PowerShell entry point', async () => {
    const executor = vi.fn(async (_file: string, _args: string[]) => ({
      stdout: '__ENSO_STATUS__working||psmux\\n',
      stderr: '',
    }));
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);

    await expect(service.status({ ...options, backend: 'psmux' })).resolves.toMatchObject({
      state: 'working',
      backend: 'psmux',
    });
    const remoteCommand = executor.mock.calls.at(-1)?.[1].at(-1) ?? '';
    expect(remoteCommand).toMatch(
      /^powershell\.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand /
    );
    const encodedCommand = remoteCommand.split('-EncodedCommand ')[1] ?? '';
    expect(Buffer.from(encodedCommand, 'base64').toString('utf16le')).toBe(
      buildStatusCommand(options.sessionName, 'psmux')
    );
    expect(wrapRemoteAgentCommand('printf ok', 'tmux')).toBe('printf ok');
  });

  it('builds attach-safe launch, offset and PowerShell psmux commands', () => {
    expect(buildLaunchCommand(options, 'tmux')).toContain('new-session -d');
    expect(buildLaunchCommand(options, 'psmux')).toContain("$pipeCommand = 'cat >> ' + $logPath");
    const tmuxLogs = buildLogsCommand(options.sessionName, 'tmux', 42);
    const psmuxLogs = buildLogsCommand(options.sessionName, 'psmux', 42);
    expect(tmuxLogs).toContain('skip=42');
    expect(tmuxLogs).toContain(`count=${REMOTE_LOG_CHUNK_BYTES}`);
    expect(psmuxLogs).toContain(`$count = [int][Math]::Min([long]${REMOTE_LOG_CHUNK_BYTES}`);
    expect(psmuxLogs).toContain('$stream.Read($bytes, 0, $count)');
    expect(psmuxLogs).not.toContain('ReadAllBytes');
  });
});
