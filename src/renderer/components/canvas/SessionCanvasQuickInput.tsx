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
  /** Focused overlay card: fill allocated height (not shrink with template count). */
  expanded?: boolean;
  className?: string;
}

export function SessionCanvasQuickInput({
  sessionId,
  kind,
  agentId,
  cwd,
  ptyIdHint,
  expanded = false,
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
        expanded={expanded}
        className={className}
      />
    </SessionCanvasSendProvider>
  );
}
