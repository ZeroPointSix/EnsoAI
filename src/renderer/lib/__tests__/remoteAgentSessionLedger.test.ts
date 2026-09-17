import { describe, expect, it } from 'vitest';
import {
  getRemoteAgentConnectionMode,
  isRemoteAgentConnectionError,
  shouldPersistAgentSession,
  shouldRenderPtyOutput,
} from '../remoteAgentSessionLedger';

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

  it('launches only before a backend is journaled and attaches on reconnect', () => {
    expect(getRemoteAgentConnectionMode()).toBe('launch');
    expect(getRemoteAgentConnectionMode('tmux')).toBe('attach');
    expect(getRemoteAgentConnectionMode('psmux')).toBe('attach');
  });

  it('maps structured SSH failures to the disconnected UI state', () => {
    expect(isRemoteAgentConnectionError('ssh-failed')).toBe(true);
    expect(isRemoteAgentConnectionError('auth-failed')).toBe(true);
    expect(isRemoteAgentConnectionError('host-unreachable')).toBe(true);
    expect(isRemoteAgentConnectionError('host-key-failed')).toBe(true);
    expect(isRemoteAgentConnectionError('invalid-options')).toBe(false);
    expect(isRemoteAgentConnectionError('mux-unavailable')).toBe(false);
  });
});
