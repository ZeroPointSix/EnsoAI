import type { RemoteAgentLaunchOptions, SshHostDiscoveryResult } from '@shared/types';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLaunchCommand,
  buildLogsCommand,
  buildStatusCommand,
  buildStopCommand,
  RemoteAgentSessionError,
  RemoteAgentSessionService,
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
    expect(executor.mock.calls.at(-1)?.[1].at(-1)).toContain('skip=6');
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
    expect(buildStopCommand(options.sessionName, 'tmux', true)).toContain('kill-session');
    expect(buildStopCommand(options.sessionName, 'tmux', true)).toContain('137');
    expect(buildLaunchCommand(options, 'tmux')).toContain('previous_state');
    expect(buildLaunchCommand(options, 'tmux')).toContain('printf stopped');
    expect(buildStatusCommand(options.sessionName, 'tmux')).not.toContain('$state" != starting');
    expect(buildStatusCommand(options.sessionName, 'psmux')).toContain("$state -eq 'disconnected'");
  });

  it('fails explicitly when neither tmux nor psmux is available', async () => {
    const executor = vi.fn(async () => {
      throw new RemoteAgentSessionError('ssh-failed', 'not found');
    });
    const service = new RemoteAgentSessionService('win32', executor, async () => discovery);
    await expect(service.capability(options)).rejects.toMatchObject({ code: 'mux-unavailable' });
    expect(executor).toHaveBeenCalledTimes(2);
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

  it('builds attach-safe launch, offset and PowerShell psmux commands', () => {
    expect(buildLaunchCommand(options, 'tmux')).toContain('new-session -d');
    expect(buildLaunchCommand(options, 'psmux')).toContain('Tee-Object');
    expect(buildLogsCommand(options.sessionName, 'tmux', 42)).toContain('skip=42');
    expect(buildLogsCommand(options.sessionName, 'psmux', 42)).toContain('$bytes[42..');
  });
});
