import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { isClaudeCanvasAgent } from '@/lib/sessionCanvasClaudeInputUtils';
import { SessionCanvasSendProvider } from './SessionCanvasSendContext';
import { SessionCanvasUnifiedQuickInput } from './SessionCanvasUnifiedQuickInput';

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
  const claudeMode = kind === 'agent' && isClaudeCanvasAgent(agentId) && Boolean(cwd);

  return (
    <SessionCanvasSendProvider>
      <SessionCanvasUnifiedQuickInput
        sessionId={sessionId}
        kind={kind}
        cwd={cwd}
        ptyIdHint={ptyIdHint}
        claudeMode={claudeMode}
        className={className}
      />
    </SessionCanvasSendProvider>
  );
}
