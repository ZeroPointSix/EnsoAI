import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { composeSessionCanvasOutgoingMessage } from '@/lib/sessionCanvasComposeMessage';
import { useSessionCanvasPromptStore } from '@/stores/sessionCanvasPromptStore';

interface SessionCanvasSendContextValue {
  supplement: string;
  setSupplement: (value: string) => void;
  clearSupplement: () => void;
  composeMessage: (body: string) => string;
  continuePrompt: string;
  enableContinueReply: boolean;
}

const SessionCanvasSendContext = createContext<SessionCanvasSendContextValue | null>(null);

export function SessionCanvasSendProvider({ children }: { children: ReactNode }) {
  const [supplement, setSupplement] = useState('');
  const promptsEnabled = useSessionCanvasPromptStore((s) => s.promptsEnabled);
  const prompts = useSessionCanvasPromptStore((s) => s.prompts);
  const reply = useSessionCanvasPromptStore((s) => s.reply);

  const clearSupplement = useCallback(() => setSupplement(''), []);

  const composeMessage = useCallback(
    (body: string) =>
      composeSessionCanvasOutgoingMessage(body, {
        supplement,
        prompts: promptsEnabled ? prompts : [],
      }),
    [supplement, prompts, promptsEnabled]
  );

  const value = useMemo(
    () => ({
      supplement,
      setSupplement,
      clearSupplement,
      composeMessage,
      continuePrompt: reply.continuePrompt,
      enableContinueReply: reply.enableContinueReply,
    }),
    [supplement, composeMessage, clearSupplement, reply]
  );

  return (
    <SessionCanvasSendContext.Provider value={value}>{children}</SessionCanvasSendContext.Provider>
  );
}

export function useSessionCanvasSend() {
  const ctx = useContext(SessionCanvasSendContext);
  if (!ctx) {
    throw new Error('useSessionCanvasSend must be used within SessionCanvasSendProvider');
  }
  return ctx;
}

export function useSessionCanvasSendOptional() {
  return useContext(SessionCanvasSendContext);
}
