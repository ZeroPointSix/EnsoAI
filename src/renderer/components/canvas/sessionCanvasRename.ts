import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSessionCanvasRenameOptions {
  displayTitle: string;
  renameRequestToken?: number;
  canRename: boolean;
  onCommit: (name: string) => void;
}

export function useSessionCanvasRename({
  displayTitle,
  renameRequestToken,
  canRename,
  onCommit,
}: UseSessionCanvasRenameOptions) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(displayTitle);
  const baselineRef = useRef(displayTitle);
  const lastTokenRef = useRef(0);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(displayTitle);
    }
  }, [displayTitle, isRenaming]);

  useEffect(() => {
    if (renameRequestToken === undefined || renameRequestToken === 0) return;
    if (lastTokenRef.current === renameRequestToken) return;
    lastTokenRef.current = renameRequestToken;
    if (!canRename) return;

    skipBlurCommitRef.current = true;
    baselineRef.current = displayTitle;
    setRenameValue(displayTitle);
    setIsRenaming(true);

    const timer = window.setTimeout(() => {
      skipBlurCommitRef.current = false;
    }, 200);
    return () => window.clearTimeout(timer);
  }, [renameRequestToken, canRename, displayTitle]);

  const commitRename = useCallback(() => {
    if (skipBlurCommitRef.current) return;
    const next = renameValue.trim();
    setIsRenaming(false);
    if (!canRename || !next) return;
    if (next === baselineRef.current) return;
    onCommit(next);
  }, [renameValue, canRename, onCommit]);

  const beginRename = useCallback(() => {
    if (!canRename) return;
    baselineRef.current = displayTitle;
    setRenameValue(displayTitle);
    setIsRenaming(true);
  }, [canRename, displayTitle]);

  const cancelRename = useCallback(() => {
    setRenameValue(baselineRef.current);
    setIsRenaming(false);
  }, []);

  return {
    isRenaming,
    renameValue,
    setRenameValue,
    commitRename,
    beginRename,
    cancelRename,
  };
}
