import { describe, expect, it } from 'vitest';
import { shouldPersistAgentSession, shouldRenderPtyOutput } from '../remoteAgentSessionLedger';

describe('shouldPersistAgentSession', () => {
  it('keeps a remote session before the local terminal becomes activated', () => {
    expect(
      shouldPersistAgentSession({
        remoteHost: 'build-box',
        agentCommand: 'custom-agent',
        activated: false,
      })
    ).toBe(true);
  });

  it('keeps the existing activation requirement for resumable local agents', () => {
    expect(shouldPersistAgentSession({ agentCommand: 'claude', activated: false })).toBe(false);
    expect(shouldPersistAgentSession({ agentCommand: 'claude', activated: true })).toBe(true);
    expect(shouldPersistAgentSession({ agentCommand: 'custom-agent', activated: true })).toBe(
      false
    );
  });

  it('uses the remote journal as the only rendered output source', () => {
    expect(shouldRenderPtyOutput()).toBe(true);
    expect(shouldRenderPtyOutput('')).toBe(true);
    expect(shouldRenderPtyOutput('build-box')).toBe(false);
  });
});
