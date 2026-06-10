import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentRuntimeActivityStore } from '../agentRuntimeActivity';
import { useTerminalWriteStore } from '../terminalWrite';

describe('terminalWrite', () => {
  beforeEach(() => {
    useAgentRuntimeActivityStore.setState({ activities: {} });
    useTerminalWriteStore.setState({
      writers: new Map(),
      focusers: new Map(),
      activeSessionId: null,
    });
  });

  it('does not arm activity for plain text insertion', () => {
    const sessionId = 'session-text-insert';
    const writer = vi.fn();
    useTerminalWriteStore.getState().register(sessionId, writer);

    useTerminalWriteStore.getState().write(sessionId, '@src/file.ts ');

    expect(writer).toHaveBeenCalledWith('@src/file.ts ');
    expect(useAgentRuntimeActivityStore.getState().activities[sessionId]?.cpuWakeArmed).toBe(
      undefined
    );
    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('idle');
  });

  it('arms activity for programmatic writes that submit with carriage return', () => {
    const sessionId = 'session-submitted-write';
    const writer = vi.fn();
    useTerminalWriteStore.getState().register(sessionId, writer);

    useTerminalWriteStore.getState().write(sessionId, 'Review this change\r');

    expect(writer).toHaveBeenCalledWith('Review this change\r');
    expect(useAgentRuntimeActivityStore.getState().activities[sessionId]?.cpuWakeArmed).toBe(true);

    useAgentRuntimeActivityStore.getState().reportOutput(sessionId, 128);
    expect(useAgentRuntimeActivityStore.getState().getPhase(sessionId)).toBe('running');
  });

  it('arms activity for active-session submit writes', () => {
    const sessionId = 'session-active-submitted-write';
    const writer = vi.fn();
    useTerminalWriteStore.getState().register(sessionId, writer);
    useTerminalWriteStore.getState().setActiveSessionId(sessionId);

    const sent = useTerminalWriteStore.getState().writeToActive('Summarize this file\n');

    expect(sent).toBe(true);
    expect(writer).toHaveBeenCalledWith('Summarize this file\n');
    expect(useAgentRuntimeActivityStore.getState().activities[sessionId]?.cpuWakeArmed).toBe(true);
  });
});
