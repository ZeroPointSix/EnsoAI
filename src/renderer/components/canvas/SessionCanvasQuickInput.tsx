import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { isClaudeCanvasAgent } from '@/lib/sessionCanvasClaudeInputUtils';
import { SessionCanvasBasicQuickInput } from './SessionCanvasBasicQuickInput';
import { SessionCanvasClaudeQuickInput } from './SessionCanvasClaudeQuickInput';

interface SessionCanvasQuickInputProps {
  sessionId: string;
  kind: SessionCanvasCardKind;
  agentId?: string;
  cwd?: string;
  className?: string;
}

export function SessionCanvasQuickInput({
  sessionId,
  kind,
  agentId,
  cwd,
  className,
}: SessionCanvasQuickInputProps) {
  if (kind === 'agent' && isClaudeCanvasAgent(agentId) && cwd) {
    return (
      <SessionCanvasClaudeQuickInput sessionId={sessionId} cwd={cwd} className={className} />
    );
  }

  return (
    <SessionCanvasBasicQuickInput sessionId={sessionId} kind={kind} className={className} />
  );
}
