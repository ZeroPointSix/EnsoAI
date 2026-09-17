import { execFile as execFileCallback } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildLaunchCommand,
  buildLogsCommand,
  buildStatusCommand,
  buildStopCommand,
} from '../RemoteAgentSessionService';

const execFile = promisify(execFileCallback);
const describeIntegration =
  process.env.ENSO_RUN_TMUX_INTEGRATION === '1' ? describe : describe.skip;
const sessions = new Set<string>();

async function run(command: string): Promise<string> {
  const result = await execFile('/bin/sh', ['-lc', command], {
    timeout: 20_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return result.stdout;
}

function sessionDirectory(sessionName: string): string {
  return join(homedir(), '.ensoai', 'sessions', sessionName);
}

async function cleanupSession(sessionName: string): Promise<void> {
  const sessionDir = sessionDirectory(sessionName).replace(/'/g, `'\\''`);
  await run(
    `tmux -L enso kill-session -t '${sessionName}' 2>/dev/null || true; rm -rf '${sessionDir}'`
  );
}

function parseStatus(stdout: string): { state: string; exitCode: string; backend: string } {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('__ENSO_STATUS__'));
  if (!line) throw new Error(`Missing status marker: ${stdout}`);
  const [state = '', exitCode = '', backend = ''] = line.slice('__ENSO_STATUS__'.length).split('|');
  return { state, exitCode, backend };
}

function parseLogs(stdout: string): { outputOffset: number; data: string } {
  const lines = stdout.split(/\r?\n/);
  const offsetLine = lines.find((entry) => entry.startsWith('__ENSO_LOG_OFFSET__'));
  const dataLine = lines.find((entry) => entry.startsWith('__ENSO_LOG_DATA__'));
  if (!offsetLine || !dataLine) throw new Error(`Missing log markers: ${stdout}`);
  return {
    outputOffset: Number(offsetLine.slice('__ENSO_LOG_OFFSET__'.length)),
    data: Buffer.from(dataLine.slice('__ENSO_LOG_DATA__'.length), 'base64').toString('utf8'),
  };
}

async function waitForState(
  sessionName: string,
  expected: string[]
): Promise<ReturnType<typeof parseStatus>> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const status = parseStatus(await run(buildStatusCommand(sessionName, 'tmux')));
    if (expected.includes(status.state)) return status;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expected.join(', ')}`);
}

describeIntegration('RemoteAgentSessionService tmux integration', () => {
  afterEach(async () => {
    await Promise.all([...sessions].map(cleanupSession));
    sessions.clear();
  });

  it('keeps a stable session, resumes logs by byte offset, and separates stop modes', async () => {
    await expect(run('tmux -V')).resolves.toContain('tmux');

    const sessionName = `enso-it-${process.pid}-${Date.now()}`;
    const forceSessionName = `${sessionName}-force`;
    sessions.add(sessionName);
    sessions.add(forceSessionName);

    const options = {
      host: 'integration-only',
      workspace: tmpdir(),
      sessionName,
      command: 'printf alpha; sleep 30',
    };

    expect(parseStatus(await run(buildLaunchCommand(options, 'tmux'))).state).toBe('starting');
    await expect(waitForState(sessionName, ['working'])).resolves.toMatchObject({
      state: 'working',
      backend: 'tmux',
    });

    await new Promise((resolve) => setTimeout(resolve, 250));
    const firstChunk = parseLogs(await run(buildLogsCommand(sessionName, 'tmux', 0)));
    const secondChunk = parseLogs(
      await run(buildLogsCommand(sessionName, 'tmux', firstChunk.outputOffset))
    );
    expect(firstChunk.data).toBe('alpha');
    expect(secondChunk).toEqual({ outputOffset: firstChunk.outputOffset, data: '' });

    expect(parseStatus(await run(buildLaunchCommand(options, 'tmux'))).state).toBe('working');
    await expect(waitForState(sessionName, ['working'])).resolves.toMatchObject({
      state: 'working',
    });

    await run(buildStopCommand(sessionName, 'tmux', false));
    await expect(waitForState(sessionName, ['stopped'])).resolves.toMatchObject({
      state: 'stopped',
    });

    const forceOptions = { ...options, sessionName: forceSessionName };
    parseStatus(await run(buildLaunchCommand(forceOptions, 'tmux')));
    await waitForState(forceSessionName, ['working']);
    await run(buildStopCommand(forceSessionName, 'tmux', true));
    await expect(waitForState(forceSessionName, ['stopped'])).resolves.toMatchObject({
      state: 'stopped',
      exitCode: '137',
    });
  });
});
