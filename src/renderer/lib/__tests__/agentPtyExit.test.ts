import { describe, expect, it } from 'vitest';
import {
  AGENT_SESSION_NOT_FOUND_MESSAGE,
  createAgentPtyExitDiagnostic,
  LEGACY_AGENT_EXIT_AUTO_CLOSE_RUNTIME_MS,
} from '../agentPtyExit';

describe('createAgentPtyExitDiagnostic', () => {
  it('keeps the Agent tab open for short PTY exits', () => {
    const diagnostic = createAgentPtyExitDiagnostic({ runtimeMs: 250, outputTail: '' });

    expect(diagnostic.shouldCloseTab).toBe(false);
    expect(diagnostic.autoCloseReason).toBe('disabled');
    expect(diagnostic.legacyAutoCloseReasons).toEqual([]);
  });

  it('keeps the Agent tab open after the legacy runtime threshold', () => {
    const diagnostic = createAgentPtyExitDiagnostic({
      runtimeMs: LEGACY_AGENT_EXIT_AUTO_CLOSE_RUNTIME_MS,
      outputTail: 'completed normally',
    });

    expect(diagnostic.shouldCloseTab).toBe(false);
    expect(diagnostic.legacyAutoCloseReasons).toEqual(['runtime-threshold']);
  });

  it('keeps the Agent tab open when the CLI reports a missing conversation', () => {
    const diagnostic = createAgentPtyExitDiagnostic({
      runtimeMs: 100,
      outputTail: `error: ${AGENT_SESSION_NOT_FOUND_MESSAGE}`,
    });

    expect(diagnostic.shouldCloseTab).toBe(false);
    expect(diagnostic.legacyAutoCloseReasons).toEqual(['session-not-found-output']);
  });
});
