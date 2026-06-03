import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  composeSessionCanvasOutgoingMessage,
  DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES,
  loadContextToggleEnabled,
  saveContextToggleEnabled,
  SESSION_CANVAS_CONTINUE_PROMPT,
} from '@/lib/sessionCanvasSendExtras';

interface SessionCanvasSendContextValue {
  supplement: string;
  setSupplement: (value: string) => void;
  clearSupplement: () => void;
  enabledById: Record<string, boolean>;
  setToggleEnabled: (id: string, enabled: boolean) => void;
  composeMessage: (body: string) => string;
  continuePrompt: string;
}

const SessionCanvasSendContext = createContext<SessionCanvasSendContextValue | null>(null);

export function SessionCanvasSendProvider({ children }: { children: ReactNode }) {
  const [supplement, setSupplement] = useState('');
  const [enabledById, setEnabledById] = useState(loadContextToggleEnabled);

  const setToggleEnabled = useCallback((id: string, enabled: boolean) => {
    setEnabledById((prev) => {
      const next = { ...prev, [id]: enabled };
      saveContextToggleEnabled(next);
      return next;
    });
  }, []);

  const clearSupplement = useCallback(() => setSupplement(''), []);

  const composeMessage = useCallback(
    (body: string) =>
      composeSessionCanvasOutgoingMessage(body, {
        supplement,
        toggles: DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES,
        enabledById,
      }),
    [supplement, enabledById]
  );

  const value = useMemo(
    () => ({
      supplement,
      setSupplement,
      clearSupplement,
      enabledById,
      setToggleEnabled,
      composeMessage,
      continuePrompt: SESSION_CANVAS_CONTINUE_PROMPT,
    }),
    [supplement, enabledById, setToggleEnabled, composeMessage, clearSupplement]
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

/** Optional compose when extras panel is not mounted (standalone fallback). */
export function useSessionCanvasSendOptional() {
  return useContext(SessionCanvasSendContext);
}
