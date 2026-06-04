import { useEffect, useRef, useState } from 'react';
import { sessionCanvasPtyExists } from '@/lib/sessionCanvasQuickSend';
import { sessionCanvasLog, shortSessionId } from '@/lib/sessionCanvasLog';
import { useSessionPtyRegistry } from '@/stores/sessionPtyRegistry';
import { useTerminalWriteStore } from '@/stores/terminalWrite';

const PTY_POLL_MS = 2000;

/**
 * PTY truth: main process keys are `pty-N`, not UI session ids.
 * Also treat a registered xterm writer as ready (terminal mounted on main window).
 */
export function useSessionCanvasPtyExists(
  sessionId: string,
  enabled: boolean,
  ptyIdHint?: string
) {
  const ptyIdFromRegistry = useSessionPtyRegistry((s) => s.ptyBySessionId[sessionId]);
  const hasWriter = useTerminalWriteStore((s) => s.writers.has(sessionId));
  const [ptyExists, setPtyExists] = useState(false);
  const [checking, setChecking] = useState(true);
  const prevExistsRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setPtyExists(false);
      setChecking(false);
      return;
    }

    if (hasWriter) {
      setPtyExists(true);
      setChecking(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const exists = await sessionCanvasPtyExists(
          sessionId,
          ptyIdHint ?? ptyIdFromRegistry
        );
        if (!cancelled) {
          if (prevExistsRef.current !== exists) {
            sessionCanvasLog('PtyCheck', 'pty exists changed', {
              sessionId: shortSessionId(sessionId),
              ptyId: ptyIdHint ?? ptyIdFromRegistry,
              exists,
              hasWriter,
            });
            prevExistsRef.current = exists;
          }
          setPtyExists(exists);
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          if (prevExistsRef.current !== false) {
            sessionCanvasLog('PtyCheck', 'pty check error', {
              sessionId: shortSessionId(sessionId),
            });
            prevExistsRef.current = false;
          }
          setPtyExists(false);
          setChecking(false);
        }
      }
    };

    setChecking(true);
    void check();
    const interval = window.setInterval(() => void check(), PTY_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionId, enabled, ptyIdHint, ptyIdFromRegistry, hasWriter]);

  return { ptyExists, checkingPty: checking };
}
