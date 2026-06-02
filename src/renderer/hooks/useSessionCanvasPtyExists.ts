import { useEffect, useState } from 'react';

const PTY_POLL_MS = 2000;

/**
 * Poll main-process PTY registry (OpenCove-style: truth lives in worker/runtime, UI checks before input).
 */
export function useSessionCanvasPtyExists(sessionId: string, enabled: boolean) {
  const [ptyExists, setPtyExists] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setPtyExists(false);
      setChecking(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const exists = await window.electronAPI.terminal.exists(sessionId);
        if (!cancelled) {
          setPtyExists(exists);
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
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
  }, [sessionId, enabled]);

  return { ptyExists, checkingPty: checking };
}
