import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SshHostConfig } from '@shared/types';

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== '\\') {
      quote = quote === char ? null : (quote ?? char);
    } else if (char === '#' && quote === null) {
      return line.slice(0, index);
    }
  }
  return line;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isConcreteAlias(alias: string): boolean {
  return Boolean(alias) && !alias.startsWith('!') && !/[*?[\]]/.test(alias);
}

export function parseSshConfig(content: string, configPath: string): SshHostConfig[] {
  const hosts = new Map<string, SshHostConfig>();
  let activeAliases: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const directive = line.match(/^([a-z][a-z0-9]*)\s*(?:=|\s)\s*(.+)$/i);
    if (!directive) continue;

    const key = directive[1].toLowerCase();
    const value = unquote(directive[2]);

    if (key === 'host') {
      activeAliases = value.split(/\s+/).map(unquote).filter(isConcreteAlias);
      for (const alias of activeAliases) {
        if (!hosts.has(alias)) {
          hosts.set(alias, { alias, configPath });
        }
      }
      continue;
    }

    for (const alias of activeAliases) {
      const host = hosts.get(alias);
      if (!host) continue;

      if (key === 'hostname' && host.hostname === undefined) {
        host.hostname = value;
      } else if (key === 'user' && host.user === undefined) {
        host.user = value;
      } else if (key === 'port' && host.port === undefined) {
        const port = Number.parseInt(value, 10);
        if (Number.isInteger(port) && port > 0 && port <= 65535) {
          host.port = port;
        }
      }
    }
  }

  return [...hosts.values()];
}

export async function listConfiguredSshHosts(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir()
): Promise<SshHostConfig[]> {
  if (platform !== 'win32') {
    return [];
  }

  const configPath = join(home, '.ssh', 'config');
  try {
    const content = await readFile(configPath, 'utf8');
    return parseSshConfig(content, configPath);
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code !== 'ENOENT') {
      console.warn('[ssh-config] Failed to read OpenSSH config', error);
    }
    return [];
  }
}
