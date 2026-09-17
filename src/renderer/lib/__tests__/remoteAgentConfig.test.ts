import { describe, expect, it } from 'vitest';
import {
  canUseAgentLocallyOrRemotely,
  isRemoteAgentConfigured,
  normalizeRemoteAgentConfig,
} from '../remoteAgentConfig';

describe('remoteAgentConfig', () => {
  it('normalizes a selected host and defaults an empty workspace', () => {
    expect(normalizeRemoteAgentConfig(' build-box ', '  ')).toEqual({
      remoteHost: 'build-box',
      remoteWorkspace: '~',
    });
  });

  it('clears the workspace when local execution is selected', () => {
    expect(normalizeRemoteAgentConfig('  ', '~/stale')).toEqual({
      remoteHost: undefined,
      remoteWorkspace: undefined,
    });
  });

  it('requires a non-empty remote host', () => {
    expect(isRemoteAgentConfigured({ remoteHost: 'host-a' })).toBe(true);
    expect(isRemoteAgentConfigured({ remoteHost: '   ' })).toBe(false);
    expect(isRemoteAgentConfigured(undefined)).toBe(false);
  });

  it('allows a configured remote agent without a local CLI installation', () => {
    expect(canUseAgentLocallyOrRemotely({ remoteHost: 'host-a' }, false)).toBe(true);
    expect(canUseAgentLocallyOrRemotely(undefined, true)).toBe(true);
    expect(canUseAgentLocallyOrRemotely(undefined, false)).toBe(false);
  });
});
