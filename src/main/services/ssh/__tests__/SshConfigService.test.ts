import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverSshHosts,
  getSshAgentLaunch,
  getSshTerminalLaunch,
  isConfiguredSshHost,
  parseSshConfig,
} from '../SshConfigService';

const tempDirectories: string[] = [];

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  );
});

describe('parseSshConfig', () => {
  it('lists concrete aliases and keeps the first value for each option', () => {
    const hosts = parseSshConfig(`
      Host *
        ServerAliveInterval 30

      Host production prod-* !production-old
        HostName "prod.example.com" # primary endpoint
        User deploy
        Port 2222
        IdentityFile ~/.ssh/id_ed25519

      Host PRODUCTION
        HostName ignored.example.com

      Match host production
        User should-not-leak
    `);

    expect(hosts).toEqual([
      {
        alias: 'production',
        hostName: 'prod.example.com',
        user: 'deploy',
        port: 2222,
      },
    ]);
  });

  it('supports equals separators and multiple concrete aliases', () => {
    const hosts = parseSshConfig(`
      Host=dev dev-short
      HostName=10.0.0.5
      User=alice
    `);

    expect(hosts.map((host) => host.alias)).toEqual(['dev', 'dev-short']);
    expect(hosts.every((host) => host.hostName === '10.0.0.5')).toBe(true);
  });
});

describe('discoverSshHosts', () => {
  it('expands relative Include globs before parsing hosts', async () => {
    const homeDir = await createTempDirectory();
    const sshDirectory = join(homeDir, '.ssh');
    const includeDirectory = join(sshDirectory, 'config.d');
    const configPath = join(sshDirectory, 'config');
    await mkdir(includeDirectory, { recursive: true });
    await writeFile(
      configPath,
      ['Include config.d/*.conf', 'Host primary', '  HostName primary.example.com'].join('\n')
    );
    await writeFile(
      join(includeDirectory, 'staging.conf'),
      ['Host staging', '  HostName staging.example.com', '  User deploy'].join('\n')
    );

    const result = await discoverSshHosts({ platform: 'win32', homeDir, configPath });

    expect(result).toEqual({
      supported: true,
      configPath,
      hosts: [
        { alias: 'primary', hostName: 'primary.example.com' },
        { alias: 'staging', hostName: 'staging.example.com', user: 'deploy' },
      ],
    });
  });

  it('resolves nested relative Includes from the user SSH directory', async () => {
    const homeDir = await createTempDirectory();
    const sshDirectory = join(homeDir, '.ssh');
    const includeDirectory = join(sshDirectory, 'config.d');
    const configPath = join(sshDirectory, 'config');
    await mkdir(includeDirectory, { recursive: true });
    await writeFile(configPath, 'Include config.d/nested.conf');
    await writeFile(join(includeDirectory, 'nested.conf'), 'Include shared.conf');
    await writeFile(
      join(sshDirectory, 'shared.conf'),
      ['Host shared', '  HostName shared.example.com'].join('\n')
    );

    const result = await discoverSshHosts({ platform: 'win32', homeDir, configPath });

    expect(result.hosts).toEqual([{ alias: 'shared', hostName: 'shared.example.com' }]);
  });

  it('caps deeply nested Includes', async () => {
    const homeDir = await createTempDirectory();
    const sshDirectory = join(homeDir, '.ssh');
    const configPath = join(sshDirectory, 'config');
    await mkdir(sshDirectory, { recursive: true });
    await writeFile(configPath, 'Include level-0.conf');

    for (let index = 0; index < 18; index += 1) {
      const content =
        index === 17
          ? ['Host too-deep', '  HostName hidden.example.com'].join('\n')
          : `Include level-${index + 1}.conf`;
      await writeFile(join(sshDirectory, `level-${index}.conf`), content);
    }

    const result = await discoverSshHosts({ platform: 'win32', homeDir, configPath });

    expect(result.hosts).toEqual([]);
  });

  it('does not advertise aliases from conditional Includes', async () => {
    const homeDir = await createTempDirectory();
    const sshDirectory = join(homeDir, '.ssh');
    const configPath = join(sshDirectory, 'config');
    await mkdir(sshDirectory, { recursive: true });
    await writeFile(
      configPath,
      ['Host bastion', '  Include conditional.conf', 'Host *', '  Include global.conf'].join('\n')
    );
    await writeFile(
      join(sshDirectory, 'conditional.conf'),
      ['Host ghost', '  HostName ghost.example.com'].join('\n')
    );
    await writeFile(
      join(sshDirectory, 'global.conf'),
      ['Host visible', '  HostName visible.example.com'].join('\n')
    );

    const result = await discoverSshHosts({ platform: 'win32', homeDir, configPath });

    expect(result.hosts).toEqual([
      { alias: 'bastion' },
      { alias: 'visible', hostName: 'visible.example.com' },
    ]);
  });

  it('distinguishes unsupported platforms and missing configs', async () => {
    const homeDir = await createTempDirectory();
    const configPath = join(homeDir, '.ssh', 'config');

    await expect(discoverSshHosts({ platform: 'linux', homeDir, configPath })).resolves.toEqual({
      supported: false,
      hosts: [],
      configPath,
      errorCode: 'unsupported-platform',
    });
    await expect(discoverSshHosts({ platform: 'win32', homeDir, configPath })).resolves.toEqual({
      supported: true,
      hosts: [],
      configPath,
      errorCode: 'config-not-found',
    });
  });
});

describe('isConfiguredSshHost', () => {
  it('accepts only aliases returned by supported discovery', () => {
    const discovery = {
      supported: true,
      configPath: 'C:\\Users\\test\\.ssh\\config',
      hosts: [{ alias: 'Production', hostName: 'prod.example.com' }],
    };

    expect(isConfiguredSshHost(discovery, 'production')).toBe(true);
    expect(isConfiguredSshHost(discovery, 'other-host')).toBe(false);
    expect(isConfiguredSshHost({ ...discovery, supported: false, hosts: [] }, 'Production')).toBe(
      false
    );
  });
});

describe('getSshTerminalLaunch', () => {
  it('uses a direct argv entry for the configured host alias', () => {
    expect(getSshTerminalLaunch('production', 'win32')).toEqual({
      shell: 'ssh.exe',
      args: ['-tt', '--', 'production'],
    });
  });

  it('rejects unsupported platforms and option-like aliases', () => {
    expect(() => getSshTerminalLaunch('production', 'linux')).toThrow(
      'SSH terminals are only supported on Windows'
    );
    expect(() => getSshTerminalLaunch('-oProxyCommand=calc.exe', 'win32')).toThrow(
      'Invalid SSH host alias'
    );
    expect(() => getSshTerminalLaunch('two hosts', 'win32')).toThrow('Invalid SSH host alias');
  });
});

describe('getSshAgentLaunch', () => {
  it('only attaches to the stable session created by the remote Agent adapter', () => {
    const launch = getSshAgentLaunch(
      {
        host: 'production',
        workspace: "/srv/team's app",
        sessionName: 'enso-session_123',
        command: "claude --prompt 'hello'",
      },
      'win32'
    );
    expect(launch.shell).toBe('ssh.exe');
    expect(launch.args.slice(0, 3)).toEqual(['-tt', '--', 'production']);
    expect(launch.args[3]).toContain("attach-session -t 'enso-session_123'");
    expect(launch.args[3]).not.toContain('new-session');
    expect(launch.args[3]).not.toContain("/srv/team's app");
    expect(launch.args[3]).not.toContain('claude');
  });

  it('rejects unsafe or incomplete remote launch options', () => {
    const valid = {
      host: 'production',
      workspace: '/srv/app',
      sessionName: 'enso-session',
      command: 'claude',
    };
    expect(() => getSshAgentLaunch({ ...valid, sessionName: 'bad;name' }, 'win32')).toThrow(
      'Invalid remote Agent session name'
    );
    expect(() => getSshAgentLaunch({ ...valid, workspace: 'bad\npath' }, 'win32')).toThrow(
      'Invalid remote Agent launch options'
    );
  });
});
