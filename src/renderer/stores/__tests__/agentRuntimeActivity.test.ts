import { beforeEach, describe, expect, it } from 'vitest';
import { useAgentRuntimeActivityStore } from '../agentRuntimeActivity';

describe('agentRuntimeActivity', () => {
  beforeEach(() => {
    useAgentRuntimeActivityStore.setState({ activities: {} });
  });

  it('keeps idle when cpu is active before a send is armed', () => {
    const sessionId = 'session-unarmed';

    useAgentRuntimeActivityStore.getState().reportCpuActive(sessionId);

    const activity = useAgentRuntimeActivityStore.getState().activities[sessionId];
    expect(activity?.phase ?? 'idle').toBe('idle');
  });

  it('allows cpu to wake running after a send is armed', () => {
    const sessionId = 'session-armed';

    useAgentRuntimeActivityStore.getState().armCpuWake(sessionId);
    useAgentRuntimeActivityStore.getState().reportCpuActive(sessionId);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('running');
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
          cpuWakeArmed: false,
          source: 'inferred',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().reportOutput(sessionId, 64);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('running');
  });

  it('ignores small output while idle (stays gray)', () => {
    const sessionId = 'session-idle';
    useAgentRuntimeActivityStore.getState().reportOutput(sessionId, 16);
    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('idle');
  });

  it('does not refresh lastOutputAt on small chunks while running', () => {
    const sessionId = 'session-small';
    const now = 50_000;
    useAgentRuntimeActivityStore.setState({
      activities: {
        [sessionId]: {
          phase: 'running',
          lastOutputAt: now - 10_000,
          lastCpuActiveAt: now - 10_000,
          lastStartedAt: now - 20_000,
          lastCompletedAt: 0,
          cpuWakeArmed: true,
          source: 'output',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().reportOutput(sessionId, 8);

    expect(useAgentRuntimeActivityStore.getState().activities[sessionId]?.lastOutputAt).toBe(
      now - 10_000
    );
  });

  it('completes running when lastCpuActiveAt is 0 and output is idle', () => {
    const sessionId = 'session-no-cpu';
    const now = 100_000;
    useAgentRuntimeActivityStore.setState({
      activities: {
        [sessionId]: {
          phase: 'running',
          lastOutputAt: now - 6_000,
          lastCpuActiveAt: 0,
          lastStartedAt: now - 20_000,
          lastCompletedAt: 0,
          cpuWakeArmed: true,
          source: 'output',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().tickIdleCheck(now);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('completed');
  });

  it('keeps completed when only cpu is reported (green hold)', () => {
    const sessionId = 'session-c';
    const now = 50_000;
    useAgentRuntimeActivityStore.setState({
      activities: {
        [sessionId]: {
          phase: 'completed',
          lastOutputAt: now - 10_000,
          lastCpuActiveAt: now - 10_000,
          lastStartedAt: now - 20_000,
          lastCompletedAt: now - 3_000,
          cpuWakeArmed: false,
          source: 'inferred',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().reportCpuActive(sessionId);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('completed');
  });

  it('transitions running → completed after cpu and output idle', () => {
    const sessionId = 'session-b';
    const now = 100_000;
    useAgentRuntimeActivityStore.setState({
      activities: {
        [sessionId]: {
          phase: 'running',
          lastOutputAt: now - 6_000,
          lastCpuActiveAt: now - 6_000,
          lastStartedAt: now - 20_000,
          lastCompletedAt: 0,
          cpuWakeArmed: true,
          source: 'pty',
        },
      },
    });

    useAgentRuntimeActivityStore.getState().tickIdleCheck(now);

    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('completed');
  });
});
