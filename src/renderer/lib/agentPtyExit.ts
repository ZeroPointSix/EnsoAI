export const AGENT_SESSION_NOT_FOUND_MESSAGE = 'No conversation found with session ID';
export const LEGACY_AGENT_EXIT_AUTO_CLOSE_RUNTIME_MS = 10000;

type LegacyAutoCloseReason = 'runtime-threshold' | 'session-not-found-output';

export interface AgentPtyExitDiagnostic {
  shouldCloseTab: false;
  closeSource: 'pty-exit';
  autoCloseReason: 'disabled';
  runtimeMs: number;
  legacyAutoCloseReasons: LegacyAutoCloseReason[];
}

interface CreateAgentPtyExitDiagnosticInput {
  runtimeMs: number;
  outputTail: string;
}

export function createAgentPtyExitDiagnostic({
  runtimeMs,
  outputTail,
}: CreateAgentPtyExitDiagnosticInput): AgentPtyExitDiagnostic {
  const legacyAutoCloseReasons: LegacyAutoCloseReason[] = [];

  if (runtimeMs >= LEGACY_AGENT_EXIT_AUTO_CLOSE_RUNTIME_MS) {
    legacyAutoCloseReasons.push('runtime-threshold');
  }

  if (outputTail.includes(AGENT_SESSION_NOT_FOUND_MESSAGE)) {
    legacyAutoCloseReasons.push('session-not-found-output');
  }

  return {
    shouldCloseTab: false,
    closeSource: 'pty-exit',
    autoCloseReason: 'disabled',
    runtimeMs,
    legacyAutoCloseReasons,
  };
}
