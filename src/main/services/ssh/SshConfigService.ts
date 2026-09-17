import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, parse, resolve } from 'node:path';
import type {
  RemoteAgentLaunchOptions,
  SshHost,
  SshHostDiscoveryResult,
  SshTerminalLaunch,
} from '@shared/types';

interface DiscoverSshHostsOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  configPath?: string;
}

interface HostBlock {
  aliases: string[];
  hostName?: string;
  user?: string;
  port?: number;
}

interface IncludeContext {
  isUnconditional: boolean;
}

const WILDCARD_PATTERN = /[*?]/;
const MAX_INCLUDE_DEPTH = 16;

function stripComment(line: string): string {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (char === '#' && !quote) {
      return line.slice(0, index);
    }
  }

  return line;
}

function tokenize(line: string): string[] {
  const normalized = stripComment(line).replace(/^(\s*[^\s=]+)\s*=\s*/, '$1 ');
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && normalized[index + 1] === quote) {
        token += quote;
        index += 1;
      } else {
        token += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
    } else {
      token += char;
    }
  }

  if (token) {
    tokens.push(token);
  }
  return tokens;
}

function hasControlOrWhitespace(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x20 || codePoint === 0x7f;
  });
}

function isConcreteAlias(alias: string): boolean {
  return Boolean(alias) && !alias.startsWith('!') && !WILDCARD_PATTERN.test(alias);
}

function addBlock(hosts: Map<string, SshHost>, block: HostBlock): void {
  for (const alias of block.aliases) {
    const key = alias.toLocaleLowerCase();
    const existing = hosts.get(key);
    if (existing) {
      existing.hostName ??= block.hostName;
      existing.user ??= block.user;
      existing.port ??= block.port;
      continue;
    }

    hosts.set(key, {
      alias,
      hostName: block.hostName,
      user: block.user,
      port: block.port,
    });
  }
}

export function parseSshConfig(content: string): SshHost[] {
  const hosts = new Map<string, SshHost>();
  let current: HostBlock | null = null;

  const finishBlock = (): void => {
    if (current) {
      addBlock(hosts, current);
      current = null;
    }
  };

  for (const line of content.split(/\r?\n/)) {
    const [rawDirective, ...values] = tokenize(line);
    if (!rawDirective) continue;

    const directive = rawDirective.toLocaleLowerCase();
    if (directive === 'host') {
      finishBlock();
      const aliases = values.filter(isConcreteAlias);
      current = aliases.length > 0 ? { aliases } : null;
      continue;
    }
    if (directive === 'match') {
      finishBlock();
      continue;
    }
    if (!current || values.length === 0) continue;

    if (directive === 'hostname' && current.hostName === undefined) {
      current.hostName = values[0];
    } else if (directive === 'user' && current.user === undefined) {
      current.user = values[0];
    } else if (directive === 'port' && current.port === undefined) {
      const port = Number.parseInt(values[0], 10);
      if (Number.isInteger(port) && port > 0 && port <= 65_535) {
        current.port = port;
      }
    }
  }

  finishBlock();
  return [...hosts.values()].sort((left, right) =>
    left.alias.localeCompare(right.alias, undefined, { sensitivity: 'base' })
  );
}

function globSegmentRegex(segment: string): RegExp {
  const escaped = segment
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

async function expandIncludePattern(pattern: string): Promise<string[]> {
  if (!WILDCARD_PATTERN.test(pattern)) {
    try {
      const info = await stat(pattern);
      return info.isFile() ? [pattern] : [];
    } catch {
      return [];
    }
  }

  const root = parse(pattern).root;
  const segments = pattern
    .slice(root.length)
    .split(/[\\/]+/)
    .filter(Boolean);

  const walk = async (currentPath: string, index: number): Promise<string[]> => {
    if (index >= segments.length) {
      try {
        const info = await stat(currentPath);
        return info.isFile() ? [currentPath] : [];
      } catch {
        return [];
      }
    }

    const segment = segments[index];
    if (!WILDCARD_PATTERN.test(segment)) {
      return walk(join(currentPath, segment), index + 1);
    }

    let entries: Dirent[];
    try {
      entries = await readdir(currentPath || root, { withFileTypes: true });
    } catch {
      return [];
    }

    const matcher = globSegmentRegex(segment);
    const matches = entries
      .filter((entry) => matcher.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name));
    const expanded = await Promise.all(
      matches.map((entry) => walk(join(currentPath, entry.name), index + 1))
    );
    return expanded.flat();
  };

  return walk(root, 0);
}

function resolveIncludePattern(pattern: string, homeDir: string): string {
  let expanded = pattern.replace(/%d/g, homeDir);
  if (expanded === '~') {
    expanded = homeDir;
  } else if (expanded.startsWith('~/') || expanded.startsWith('~\\')) {
    expanded = join(homeDir, expanded.slice(2));
  }
  return isAbsolute(expanded) ? expanded : resolve(homeDir, '.ssh', expanded);
}

function updateIncludeContext(context: IncludeContext, directive: string, values: string[]): void {
  if (directive === 'host') {
    context.isUnconditional = values.length === 1 && values[0] === '*';
  } else if (directive === 'match') {
    context.isUnconditional = values.length === 1 && values[0].toLocaleLowerCase() === 'all';
  }
}

async function readExpandedConfig(
  configPath: string,
  homeDir: string,
  context: IncludeContext = { isUnconditional: true },
  activePaths = new Set<string>(),
  depth = 0
): Promise<string> {
  if (depth > MAX_INCLUDE_DEPTH) return '';
  const normalizedPath = resolve(configPath);
  if (activePaths.has(normalizedPath)) return '';

  activePaths.add(normalizedPath);
  try {
    const content = await readFile(normalizedPath, 'utf8');
    const output: string[] = [];

    for (const line of content.split(/\r?\n/)) {
      const [rawDirective, ...values] = tokenize(line);
      const directive = rawDirective?.toLocaleLowerCase();
      if (directive !== 'include') {
        output.push(line);
        if (directive) updateIncludeContext(context, directive, values);
        continue;
      }

      // A conditional Include is only read for matching connection targets. Skipping it avoids
      // advertising aliases that `ssh <alias>` would never load from that condition.
      if (!context.isUnconditional) continue;

      for (const includePattern of values) {
        const resolvedPattern = resolveIncludePattern(includePattern, homeDir);
        const includePaths = await expandIncludePattern(resolvedPattern);
        for (const includePath of includePaths) {
          try {
            output.push(
              await readExpandedConfig(includePath, homeDir, context, activePaths, depth + 1)
            );
          } catch {
            // OpenSSH ignores include globs that do not resolve to readable files.
          }
        }
      }
    }

    return output.join('\n');
  } finally {
    activePaths.delete(normalizedPath);
  }
}

export async function discoverSshHosts(
  options: DiscoverSshHostsOptions = {}
): Promise<SshHostDiscoveryResult> {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? homedir();
  const configPath = options.configPath ?? join(homeDir, '.ssh', 'config');

  if (platform !== 'win32') {
    return {
      supported: false,
      hosts: [],
      configPath,
      errorCode: 'unsupported-platform',
    };
  }

  try {
    const content = await readExpandedConfig(configPath, homeDir);
    return { supported: true, hosts: parseSshConfig(content), configPath };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      supported: true,
      hosts: [],
      configPath,
      errorCode: code === 'ENOENT' ? 'config-not-found' : 'config-unreadable',
    };
  }
}

export function isConfiguredSshHost(discovery: SshHostDiscoveryResult, alias: string): boolean {
  const normalizedAlias = alias.trim().toLocaleLowerCase();
  return (
    discovery.supported &&
    Boolean(normalizedAlias) &&
    discovery.hosts.some((host) => host.alias.toLocaleLowerCase() === normalizedAlias)
  );
}

export function getSshTerminalLaunch(
  alias: string,
  platform: NodeJS.Platform = process.platform
): SshTerminalLaunch {
  const normalizedAlias = alias.trim();
  if (platform !== 'win32') {
    throw new Error('SSH terminals are only supported on Windows');
  }
  if (
    !normalizedAlias ||
    normalizedAlias.startsWith('-') ||
    hasControlOrWhitespace(normalizedAlias)
  ) {
    throw new Error('Invalid SSH host alias');
  }

  return {
    shell: 'ssh.exe',
    args: ['-tt', '--', normalizedAlias],
  };
}

function quotePosixShell(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function getSshAgentLaunch(
  options: RemoteAgentLaunchOptions,
  platform: NodeJS.Platform = process.platform
): SshTerminalLaunch {
  const { host, workspace, sessionName, command, backend = 'tmux' } = options;
  const base = getSshTerminalLaunch(host, platform);
  const normalizedWorkspace = workspace.trim();
  const normalizedCommand = command.trim();

  if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
    throw new Error('Invalid remote Agent session name');
  }
  if (
    !normalizedWorkspace ||
    !normalizedCommand ||
    /[\r\n\0]/.test(normalizedWorkspace) ||
    /[\r\n\0]/.test(normalizedCommand)
  ) {
    throw new Error('Invalid remote Agent launch options');
  }

  if (backend !== 'tmux' && backend !== 'psmux') {
    throw new Error('Invalid remote Agent multiplexer');
  }

  const remoteCommand = [
    backend === 'tmux' ? 'env -u TMUX tmux -L enso' : 'psmux -L enso',
    'attach-session',
    `-t ${backend === 'tmux' ? quotePosixShell(sessionName) : sessionName}`,
  ].join(' ');

  return {
    shell: base.shell,
    args: [...base.args, remoteCommand],
  };
}
