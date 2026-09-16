import { describe, expect, it } from 'vitest';
import { listConfiguredSshHosts, parseSshConfig } from '../SshConfig';

describe('parseSshConfig', () => {
  it('returns concrete aliases with connection details', () => {
    const hosts = parseSshConfig(
      `
        Host production staging
          HostName prod.example.com
          User deploy
          Port 2222

        Host *
          ServerAliveInterval 30

        Host !blocked *.internal
          User ignored

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
        alias: 'dev',
        hostname: '10.0.0.8',
        configPath: 'C:\\Users\\test\\.ssh\\config',
      },
    ]);
  });

  it('does not scan SSH config outside Windows', async () => {
    await expect(listConfiguredSshHosts('linux', '/tmp/unused')).resolves.toEqual([]);
  });
});
