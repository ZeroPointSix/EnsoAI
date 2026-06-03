import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { isClaudeCanvasAgent } from '@/lib/sessionCanvasClaudeInputUtils';
import { SessionCanvasBasicQuickInput } from './SessionCanvasBasicQuickInput';
import { SessionCanvasClaudeQuickInput } from './SessionCanvasClaudeQuickInput';
import { SessionCanvasSendProvider } from './SessionCanvasSendContext';

interface SessionCanvasQuickInputProps {
  sessionId: string;
  kind: SessionCanvasCardKind;
  agentId?: string;
  cwd?: string;
  ptyIdHint?: string;
  className?: string;
}

export function SessionCanvasQuickInput({
  sessionId,
  kind,
  agentId,
  cwd,
  ptyIdHint,
  className,
}: SessionCanvasQuickInputProps) {
  return (
    <SessionCanvasSendProvider>
      {kind === 'agent' && isClaudeCanvasAgent(agentId) && cwd ? (
        <SessionCanvasClaudeQuickInput
          sessionId={sessionId}
          cwd={cwd}
          ptyIdHint={ptyIdHint}
          className={className}
        />
      ) : (
        <SessionCanvasBasicQuickInput
          sessionId={sessionId}
          kind={kind}
          ptyIdHint={ptyIdHint}
          className={className}
        />
      )}
    </SessionCanvasSendProvider>
  );
}
