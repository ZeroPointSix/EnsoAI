import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listConfiguredSshHosts, parseSshConfig } from '../SshConfig';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe('parseSshConfig', () => {
  it('returns concrete aliases with connection details', () => {
    const hosts = parseSshConfig(
      `
        hOsT production staging "quoted"
          HostName prod.example.com
          User deploy
          Port 2222

        Host *
          ServerAliveInterval 30

        Host !blocked *.internal -Fattack
          User ignored

        Host match-target
        Match host match-target
          HostName must-not-leak.example.com

        Host dev
          HostName "10.0.0.8" # inline comment
      `,
      'C:\\Users\\test\\.ssh\\config'
    );

    expect(hosts).toEqual([
      {
        alias: 'production',
        hostname: 'prod.example.com',
        user: 'deploy',
        port: 2222,
        configPath: 'C:\\Users\\test\\.ssh\\config',
      },
      {
        alias: 'staging',
        hostname: 'prod.example.com',
        user: 'deploy',
        port: 2222,
        configPath: 'C:\\Users\\test\\.ssh\\config',
      },
      {
        alias: 'quoted',
        hostname: 'prod.example.com',
        user: 'deploy',
        port: 2222,
        configPath: 'C:\\Users\\test\\.ssh\\config',
      },
      {
        alias: 'match-target',
        configPath: 'C:\\Users\\test\\.ssh\\config',
      },
      {
        alias: 'dev',
        hostname: '10.0.0.8',
        configPath: 'C:\\Users\\test\\.ssh\\config',
      },
    ]);
  });

  it('discovers aliases from recursive and wildcard Includes', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
    tempDirectories.push(home);
    const sshDirectory = join(home, '.ssh');
    const configDirectory = join(sshDirectory, 'conf.d');
    const nestedDirectory = join(configDirectory, 'nested');
    const spacedDirectory = join(sshDirectory, 'conf with spaces');
    await Promise.all([
      mkdir(nestedDirectory, { recursive: true }),
      mkdir(spacedDirectory, { recursive: true }),
    ]);

    await Promise.all([
      writeFile(
        join(sshDirectory, 'config'),
        'Include conf.d/*.conf "conf with spaces/extra.conf"\nHost root\n  User local\n'
      ),
      writeFile(
        join(configDirectory, 'a.conf'),
        'Host included-a\n  HostName a.example.com\nInclude conf.d/nested/*.conf\n'
      ),
      writeFile(join(configDirectory, 'b.conf'), 'HOST included-b\n  Port 2202\n'),
      writeFile(join(nestedDirectory, 'c.conf'), 'Host nested\n  User deploy\n'),
      writeFile(join(spacedDirectory, 'extra.conf'), 'Host spaced\n'),
    ]);

    await expect(listConfiguredSshHosts('win32', home)).resolves.toEqual([
      {
        alias: 'included-a',
        hostname: 'a.example.com',
        configPath: join(configDirectory, 'a.conf'),
      },
      {
        alias: 'nested',
        user: 'deploy',
        configPath: join(nestedDirectory, 'c.conf'),
      },
      {
        alias: 'included-b',
        port: 2202,
        configPath: join(configDirectory, 'b.conf'),
      },
      {
        alias: 'spaced',
        configPath: join(spacedDirectory, 'extra.conf'),
      },
      {
        alias: 'root',
        user: 'local',
        configPath: join(sshDirectory, 'config'),
      },
    ]);
  });

  it('resolves nested relative Includes from the user SSH directory', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
    tempDirectories.push(home);
    const sshDirectory = join(home, '.ssh');
    const nestedDirectory = join(sshDirectory, 'nested');
    await mkdir(nestedDirectory, { recursive: true });
    await Promise.all([
      writeFile(join(sshDirectory, 'config'), 'Include nested/hosts.conf\n'),
      writeFile(join(nestedDirectory, 'hosts.conf'), 'Host nested-relative\n'),
    ]);

    await expect(listConfiguredSshHosts('win32', home)).resolves.toEqual([
      {
        alias: 'nested-relative',
        configPath: join(nestedDirectory, 'hosts.conf'),
      },
    ]);
  });

  it('handles Include cycles without duplicating hosts', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
    tempDirectories.push(home);
    const sshDirectory = join(home, '.ssh');
    await mkdir(sshDirectory, { recursive: true });
    await Promise.all([
      writeFile(join(sshDirectory, 'config'), 'Include cycle.conf\nHost root\n'),
      writeFile(join(sshDirectory, 'cycle.conf'), 'Include config\nHost cycle\n'),
    ]);

    await expect(listConfiguredSshHosts('win32', home)).resolves.toEqual([
      { alias: 'cycle', configPath: join(sshDirectory, 'cycle.conf') },
      { alias: 'root', configPath: join(sshDirectory, 'config') },
    ]);
  });

  it('rejects Include chains beyond the depth limit', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
    tempDirectories.push(home);
    const sshDirectory = join(home, '.ssh');
    await mkdir(sshDirectory, { recursive: true });
    const includePaths = Array.from({ length: 17 }, (_, index) =>
      join(sshDirectory, `depth-${index}.conf`)
    );
    await writeFile(join(sshDirectory, 'config'), 'Include depth-0.conf\n');
    await Promise.all(
      includePaths.map((path, index) =>
        writeFile(
          path,
          index === includePaths.length - 1
            ? 'Host unreachable\n'
            : `Include depth-${index + 1}.conf\n`
        )
      )
    );

    await expect(listConfiguredSshHosts('win32', home)).rejects.toThrow(
      'SSH config Include depth exceeds 16'
    );
  });

  it('returns an empty list when the Windows config does not exist', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
    tempDirectories.push(home);
    await expect(listConfiguredSshHosts('win32', home)).resolves.toEqual([]);
  });

  it('surfaces unexpected config read errors', async () => {
    const home = await mkdtemp(join(tmpdir(), 'ensoai-ssh-'));
    tempDirectories.push(home);
    await mkdir(join(home, '.ssh', 'config'), { recursive: true });
    await expect(listConfiguredSshHosts('win32', home)).rejects.toThrow(
      'Failed to read SSH config'
    );
  });

  it('does not scan SSH config outside Windows', async () => {
    await expect(listConfiguredSshHosts('linux', '/tmp/unused')).resolves.toEqual([]);
  });
});
