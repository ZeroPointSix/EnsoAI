import { beforeEach, describe, expect, it } from 'vitest';
import { useAgentRuntimeActivityStore } from '../agentRuntimeActivity';

describe('agentRuntimeActivity', () => {
  beforeEach(() => {
    useAgentRuntimeActivityStore.setState({ activities: {} });
  });

  it('transitions completed → running on terminal output', () => {
    const sessionId = 'session-a';
    useAgentRuntimeActivityStore.setState({
      activities: {
        [sessionId]: {
          phase: 'completed',
          lastOutputAt: 0,
          lastCpuActiveAt: 0,
          lastStartedAt: 1000,
          lastCompletedAt: 5000,
          source: 'inferred',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().reportOutput(sessionId);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('running');
  });

  it('transitions running → completed after cpu and output idle', () => {
    const sessionId = 'session-b';
    const now = 10_000;
    useAgentRuntimeActivityStore.setState({
      activities: {
        [sessionId]: {
          phase: 'running',
          lastOutputAt: now - 2_000,
          lastCpuActiveAt: now - 2_000,
          lastStartedAt: now - 5_000,
          lastCompletedAt: 0,
          source: 'pty',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().tickIdleCheck(now);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('completed');
  });
});
