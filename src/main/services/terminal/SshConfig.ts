import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, parse, resolve } from 'node:path';
import type { SshHostConfig } from '@shared/types';

const MAX_INCLUDE_DEPTH = 16;

interface SshConfigLine {
  configPath: string;
  text: string;
}

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

function splitArguments(value: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (const char of value.trim()) {
    if (char === '"' || char === "'") {
      if (quote === char) {
        quote = null;
      } else if (quote === null) {
        quote = char;
      } else {
        current += char;
      }
    } else if (/\s/.test(char) && quote === null) {
      if (current) {
        result.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }
  return result;
}

function isConcreteAlias(alias: string): boolean {
  return (
    Boolean(alias) &&
    !alias.startsWith('!') &&
    !alias.startsWith('-') &&
    !/\s/.test(alias) &&
    !/[*?[\]]/.test(alias)
  );
}

function parseDirective(line: string): { key: string; value: string } | null {
  const directive = line.match(/^([a-z][a-z0-9]*)\s*(?:=|\s)\s*(.+)$/i);
  if (!directive) return null;
  return { key: directive[1].toLowerCase(), value: directive[2] };
}

function parseSshConfigLines(lines: SshConfigLine[]): SshHostConfig[] {
  const hosts = new Map<string, SshHostConfig>();
  let activeAliases: string[] = [];

  for (const source of lines) {
    const line = stripComment(source.text).trim();
    if (!line) continue;

    const directive = parseDirective(line);
    if (!directive) continue;

    if (directive.key === 'host') {
      activeAliases = splitArguments(directive.value).filter(isConcreteAlias);
      for (const alias of activeAliases) {
        if (!hosts.has(alias)) {
          hosts.set(alias, { alias, configPath: source.configPath });
        }
      }
      continue;
    }

    if (directive.key === 'match') {
      activeAliases = [];
      continue;
    }

    const value = unquote(directive.value);
    for (const alias of activeAliases) {
      const host = hosts.get(alias);
      if (!host) continue;

      if (directive.key === 'hostname' && host.hostname === undefined) {
        host.hostname = value;
      } else if (directive.key === 'user' && host.user === undefined) {
        host.user = value;
      } else if (directive.key === 'port' && host.port === undefined) {
        const port = Number.parseInt(value, 10);
        if (Number.isInteger(port) && port > 0 && port <= 65535) {
          host.port = port;
        }
      }
    }
  }

  return [...hosts.values()];
}

function globSegmentToRegExp(segment: string): RegExp {
  const escaped = segment
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function expandHomePath(pattern: string, home: string): string {
  if (pattern === '~') return home;
  if (pattern.startsWith('~/') || pattern.startsWith('~\\')) {
    return join(home, pattern.slice(2));
  }
  return pattern;
}

async function expandIncludePattern(pattern: string, home: string): Promise<string[]> {
  const expanded = expandHomePath(pattern, home);
  const absolutePattern = isAbsolute(expanded)
    ? resolve(expanded)
    : resolve(home, '.ssh', expanded);
  const root = parse(absolutePattern).root;
  const segments = absolutePattern
    .slice(root.length)
    .split(/[\\/]+/)
    .filter(Boolean);
  let candidates = [root];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const hasWildcard = segment.includes('*') || segment.includes('?');
    if (!hasWildcard) {
      candidates = candidates.map((candidate) => join(candidate, segment));
      continue;
    }

    const matcher = globSegmentToRegExp(segment);
    const isLastSegment = index === segments.length - 1;
    const matches: string[] = [];
    for (const candidate of candidates) {
      try {
        const entries = await readdir(candidate, { withFileTypes: true });
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          if (
            matcher.test(entry.name) &&
            ((isLastSegment && entry.isFile()) || (!isLastSegment && entry.isDirectory()))
          ) {
            matches.push(join(candidate, entry.name));
          }
        }
      } catch (error) {
        if (getErrorCode(error) !== 'ENOENT') throw error;
      }
    }
    candidates = matches;
  }

  return candidates;
}

function getErrorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

async function readSshConfigLines(
  configPath: string,
  home: string,
  includeStack: Set<string>,
  depth: number
): Promise<SshConfigLine[]> {
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new Error(`SSH config Include depth exceeds ${MAX_INCLUDE_DEPTH}`);
  }

  const resolvedPath = resolve(configPath);
  const pathKey = resolvedPath.toLowerCase();
  if (includeStack.has(pathKey)) {
    return [];
  }

  let content: string;
  try {
    content = await readFile(resolvedPath, 'utf8');
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') return [];
    throw new Error(`Failed to read SSH config: ${resolvedPath}`, { cause: error });
  }

  includeStack.add(pathKey);
  try {
    const lines: SshConfigLine[] = [];
    for (const rawLine of content.split(/\r?\n/)) {
      const directive = parseDirective(stripComment(rawLine).trim());
      if (directive?.key !== 'include') {
        lines.push({ text: rawLine, configPath: resolvedPath });
        continue;
      }

      for (const pattern of splitArguments(directive.value)) {
        const includedPaths = await expandIncludePattern(pattern, home);
        for (const includedPath of includedPaths) {
          lines.push(...(await readSshConfigLines(includedPath, home, includeStack, depth + 1)));
        }
      }
    }
    return lines;
  } finally {
    includeStack.delete(pathKey);
  }
}

export function parseSshConfig(content: string, configPath: string): SshHostConfig[] {
  return parseSshConfigLines(content.split(/\r?\n/).map((text) => ({ text, configPath })));
}

export async function listConfiguredSshHosts(
  platform: NodeJS.Platform = process.platform,
  home: string = homedir()
): Promise<SshHostConfig[]> {
  if (platform !== 'win32') {
    return [];
  }

  const configPath = join(home, '.ssh', 'config');
  const lines = await readSshConfigLines(configPath, home, new Set(), 0);
  return parseSshConfigLines(lines);
}
