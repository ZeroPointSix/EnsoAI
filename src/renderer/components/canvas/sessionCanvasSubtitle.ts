import { getPathBasename } from '@shared/utils/path';
import type { CanvasCardItem } from './SessionCanvasCard';

const AGENT_INFO: Record<string, { name: string; command: string }> = {
  claude: { name: 'Claude', command: 'claude' },
  codex: { name: 'Codex', command: 'codex' },
  droid: { name: 'Droid', command: 'droid' },
  gemini: { name: 'Gemini', command: 'gemini' },
  auggie: { name: 'Auggie', command: 'auggie' },
  cursor: { name: 'Cursor', command: 'cursor-agent' },
  opencode: { name: 'OpenCode', command: 'opencode' },
};

function getAgentBaseId(agentId: string): string {
  if (agentId.endsWith('-hapi')) return agentId.slice(0, -5);
  if (agentId.endsWith('-happy')) return agentId.slice(0, -6);
  return agentId;
}

/** Secondary line under card title: agent launch label + CLI command (not repo/worktree). */
export function resolveSessionCanvasSubtitle(item: CanvasCardItem, fallbackShell: string): string {
  if (item.kind === 'terminal') {
    return fallbackShell;
  }

  const { agentId, agentCommand, customPath } = item.session;
  const baseId = getAgentBaseId(agentId);
  const info = AGENT_INFO[baseId];
  const launchName = info?.name ?? agentId;
  const command = customPath
    ? getPathBasename(customPath)
    : agentCommand || info?.command || agentId;

  if (!command || command === launchName) {
    return launchName;
  }
  return `${launchName} · ${command}`;
}
