import { describe, expect, it } from 'vitest';
import { resolveAgentDisplayStateForSnapshot } from '../buildSessionCanvasSnapshot';
import type { AgentRuntimeActivity } from '@/stores/agentRuntimeActivity';

const baseActivity = (phase: AgentRuntimeActivity['phase']): AgentRuntimeActivity => ({
  phase,
  lastOutputAt: 0,
  lastCpuActiveAt: 0,
  lastStartedAt: 0,
  lastCompletedAt: 0,
  source: 'pty',
});

describe('resolveAgentDisplayStateForSnapshot', () => {
  it('maps running phase to working', () => {
    expect(
      resolveAgentDisplayStateForSnapshot({
        activity: baseActivity('running'),
        outputState: 'idle',
      })
    ).toBe('working');
  });

  it('prefers hook blocked over running activity', () => {
    expect(
      resolveAgentDisplayStateForSnapshot({
        activity: baseActivity('running'),
        hookState: 'blocked',
        outputState: 'outputting',
      })
    ).toBe('blocked');
  });

  it('falls back to outputState when no activity', () => {
    expect(
      resolveAgentDisplayStateForSnapshot({
        outputState: 'outputting',
      })
    ).toBe('working');
  });

  it('maps completed phase to completed', () => {
    expect(
      resolveAgentDisplayStateForSnapshot({
        activity: baseActivity('completed'),
        outputState: 'idle',
      })
    ).toBe('completed');
  });
});
