import type { FileSearchResult } from '@shared/types/search';
import { Paperclip, Send, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toastManager } from '@/components/ui/toast';
import { useSessionCanvasPtyExists } from '@/hooks/useSessionCanvasPtyExists';
import { useI18n } from '@/i18n';
import { toLocalFileUrl } from '@/lib/localFileUrl';
import {
  CANVAS_MAX_IMAGES,
  extractMentionQuery,
  insertMentionAtCursor,
  saveCanvasInputImageToTemp,
} from '@/lib/sessionCanvasClaudeInputUtils';
import { sendSessionCanvasQuickInput } from '@/lib/sessionCanvasQuickSend';
import { cn } from '@/lib/utils';

interface SessionCanvasClaudeQuickInputProps {
  sessionId: string;
  cwd: string;
  ptyIdHint?: string;
  className?: string;
}

export function SessionCanvasClaudeQuickInput({
  sessionId,
  cwd,
  ptyIdHint,
  className,
}: SessionCanvasClaudeQuickInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<FileSearchResult[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const { ptyExists, checkingPty } = useSessionCanvasPtyExists(sessionId, true, ptyIdHint);

  useEffect(() => {
    if (!ptyExists || checkingPty) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [sessionId, ptyExists, checkingPty]);

  useEffect(() => {
    if (mentionQuery === null || !cwd) {
      setMentionResults([]);
      return;
    }
    const timer = setTimeout(() => {
      window.electronAPI.search
        .files({ rootPath: cwd, query: mentionQuery, maxResults: 10 })
        .then(setMentionResults)
        .catch(() => setMentionResults([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [mentionQuery, cwd]);

  useEffect(() => {
    const list = mentionListRef.current;
    if (!list) return;
    const item = list.children[mentionIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [mentionIndex]);

  const handleContentChange = useCallback((next: string) => {
    setValue(next);
    if (composingRef.current) return;
    setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const cursor = ta.selectionStart;
      setMentionQuery(extractMentionQuery(next, cursor));
      setMentionIndex(0);
    }, 0);
  }, []);

  const insertMention = useCallback((item: FileSearchResult) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const { nextContent, nextCursor } = insertMentionAtCursor(value, cursor, item);
    setValue(nextContent);
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  }, [value]);

  const addImageFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      if (imagePaths.length + imageFiles.length > CANVAS_MAX_IMAGES) {
        toastManager.add({
          type: 'warning',
          title: t('Too many images'),
          description: t('Max images is {{count}}', { count: CANVAS_MAX_IMAGES }),
        });
        return;
      }
      const nextPaths = [...imagePaths];
      const results = await Promise.all(
        imageFiles.map((file) => saveCanvasInputImageToTemp(file, t))
      );
      for (const path of results) {
        if (path) nextPaths.push(path);
      }
      if (nextPaths.length !== imagePaths.length) {
        setImagePaths(nextPaths);
      }
    },
    [imagePaths, t]
  );

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (
      (!trimmed && imagePaths.length === 0) ||
      sendingRef.current ||
      sending ||
      !ptyExists
    ) {
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      const sent = await sendSessionCanvasQuickInput(sessionId, trimmed, imagePaths, ptyIdHint);
      if (!sent) {
        toastManager.add({
          type: 'warning',
          title: t('Session not running'),
          description: t('Open the session with Ctrl+click to start its terminal first.'),
        });
        return;
      }
      setValue('');
      setImagePaths([]);
      setMentionQuery(null);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [value, imagePaths, sending, sessionId, ptyExists, t, ptyIdHint]);

  const disabled = sending || checkingPty || !ptyExists;
  const canSend = Boolean(value.trim() || imagePaths.length > 0);

  return (
    <div
      className={cn('relative flex shrink-0 flex-col gap-1.5', className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {mentionQuery !== null && mentionResults.length > 0 ? (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-[200px] overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div ref={mentionListRef} className="max-h-[160px] overflow-y-auto py-1">
            {mentionResults.map((item, i) => {
              const lastSep = item.relativePath.lastIndexOf('/');
              const fileName =
                lastSep > 0 ? item.relativePath.slice(lastSep + 1) : item.relativePath;
              const dirPart = lastSep > 0 ? item.relativePath.slice(0, lastSep) : '';
              return (
                <button
                  key={item.path}
                  type="button"
                  className={cn(
                    'w-full truncate px-2.5 py-1 text-left text-[11px]',
                    i === mentionIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(item);
                  }}
                >
                  <span>{fileName}</span>
                  {dirPart ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">{dirPart}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!checkingPty && !ptyExists ? (
        <p className="rounded-md border border-dashed border-border/80 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
          {t('Terminal not running — Ctrl+click to open this session first.')}
        </p>
      ) : null}

      {imagePaths.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {imagePaths.map((path, index) => (
            <div
              key={path}
              className="group relative h-10 w-10 overflow-hidden rounded border border-border/80"
            >
              <img
                src={toLocalFileUrl(path)}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setImagePaths((prev) => prev.filter((_, i) => i !== index))}
                aria-label={t('Remove')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files) void addImageFiles(Array.from(files));
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          disabled={disabled || imagePaths.length >= CANVAS_MAX_IMAGES}
          title={t('Attach image')}
          aria-label={t('Attach image')}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          rows={2}
          disabled={disabled}
          placeholder={t('Send a Claude prompt… (@ file, images supported)')}
          className={cn(
            'min-h-[52px] max-h-28 min-w-0 flex-1 resize-y rounded-md border border-border/80',
            'bg-background/90 px-2.5 py-2 font-mono text-[11px] leading-snug',
            'placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'cursor-not-allowed opacity-60'
          )}
          onChange={(e) => handleContentChange(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const imageFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) imageFiles.push(file);
              }
            }
            if (imageFiles.length > 0) {
              e.preventDefault();
              void addImageFiles(imageFiles);
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (mentionQuery !== null && mentionResults.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((prev) => (prev + 1) % mentionResults.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(
                  (prev) => (prev - 1 + mentionResults.length) % mentionResults.length
                );
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                insertMention(mentionResults[mentionIndex]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-9 w-9 shrink-0"
          disabled={disabled || !canSend}
          title={t('Send')}
          aria-label={t('Send')}
          onClick={() => void handleSend()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/80">
        {t('Enter to send · Shift+Enter for newline · @ to mention files')}
      </p>
    </div>
  );
}
