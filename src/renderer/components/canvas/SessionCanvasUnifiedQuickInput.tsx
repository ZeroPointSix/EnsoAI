import type { FileSearchResult } from '@shared/types/search';
import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { Paperclip, Play, Send, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toastManager } from '@/components/ui/toast';
import { Switch } from '@/components/ui/switch';
import { useSessionCanvasPtyExists } from '@/hooks/useSessionCanvasPtyExists';
import { useI18n } from '@/i18n';
import { toLocalFileUrl } from '@/lib/localFileUrl';
import {
  buildSessionCanvasEnhanceMessage,
  getConditionalPromptDescription,
} from '@/lib/sessionCanvasComposeMessage';
import {
  CANVAS_MAX_IMAGES,
  extractMentionQuery,
  insertMentionAtCursor,
  insertPathAtCursor,
  isImageFilePath,
  saveCanvasInputImageToTemp,
} from '@/lib/sessionCanvasClaudeInputUtils';
import { sendSessionCanvasQuickInput } from '@/lib/sessionCanvasQuickSend';
import { cn } from '@/lib/utils';
import {
  selectConditionalPrompts,
  selectNormalPrompts,
  useSessionCanvasPromptStore,
} from '@/stores/sessionCanvasPromptStore';
import { useSessionCanvasSend } from './SessionCanvasSendContext';

interface SessionCanvasUnifiedQuickInputProps {
  sessionId: string;
  kind: SessionCanvasCardKind;
  cwd?: string;
  ptyIdHint?: string;
  claudeMode?: boolean;
  className?: string;
}

export function SessionCanvasUnifiedQuickInput({
  sessionId,
  kind,
  cwd,
  ptyIdHint,
  claudeMode = false,
  className,
}: SessionCanvasUnifiedQuickInputProps) {
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
  const { composeMessage, clearSupplement, continuePrompt, supplement, setSupplement } =
    useSessionCanvasSend();

  const promptsEnabled = useSessionCanvasPromptStore((s) => s.promptsEnabled);
  const prompts = useSessionCanvasPromptStore((s) => s.prompts);
  const setConditionalState = useSessionCanvasPromptStore((s) => s.setConditionalState);
  const enableContinueReply = useSessionCanvasPromptStore((s) => s.reply.enableContinueReply);

  const normalPrompts = selectNormalPrompts(prompts);
  const conditionalPrompts = selectConditionalPrompts(prompts);

  useEffect(() => {
    if (!ptyExists || checkingPty) return;
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [sessionId, ptyExists, checkingPty]);

  useEffect(() => {
    if (!claudeMode || mentionQuery === null || !cwd) {
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
  }, [mentionQuery, cwd, claudeMode]);

  useEffect(() => {
    const list = mentionListRef.current;
    if (!list) return;
    const item = list.children[mentionIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [mentionIndex]);

  const handleContentChange = useCallback(
    (next: string) => {
      setValue(next);
      if (!claudeMode || composingRef.current) return;
      setTimeout(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const cursor = ta.selectionStart;
        setMentionQuery(extractMentionQuery(next, cursor));
        setMentionIndex(0);
      }, 0);
    },
    [claudeMode]
  );

  const insertMention = useCallback(
    (item: FileSearchResult) => {
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
    },
    [value]
  );

  const insertFilePath = useCallback(
    (filePath: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const cursor = ta.selectionStart;
      const { nextContent, nextCursor } = insertPathAtCursor(value, cursor, filePath, {
        useAtPrefix: claudeMode,
      });
      setValue(nextContent);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(nextCursor, nextCursor);
      }, 0);
    },
    [value, claudeMode]
  );

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

  const handleAttachPaths = useCallback(
    async (paths: string[]) => {
      for (const path of paths) {
        if (!path) continue;
        if (isImageFilePath(path)) {
          if (imagePaths.length >= CANVAS_MAX_IMAGES) {
            toastManager.add({
              type: 'warning',
              title: t('Too many images'),
              description: t('Max images is {{count}}', { count: CANVAS_MAX_IMAGES }),
            });
            continue;
          }
          if (!imagePaths.includes(path)) {
            setImagePaths((prev) => [...prev, path]);
          }
        } else {
          insertFilePath(path);
        }
      }
    },
    [imagePaths, insertFilePath, t]
  );

  const handlePickFiles = useCallback(async () => {
    const path = await window.electronAPI.dialog.openFile();
    if (path) {
      await handleAttachPaths([path]);
    }
  }, [handleAttachPaths]);

  const handleFileInputChange = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const list = Array.from(files);
      const imageFiles: File[] = [];
      const otherPaths: string[] = [];

      for (const file of list) {
        const filePath = (file as File & { path?: string }).path;
        if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        } else if (filePath) {
          otherPaths.push(filePath);
        }
      }

      if (imageFiles.length > 0) {
        void addImageFiles(imageFiles);
      }
      if (otherPaths.length > 0) {
        void handleAttachPaths(otherPaths);
      }
    },
    [addImageFiles, handleAttachPaths]
  );

  const deliverMessage = useCallback(
    async (raw: string, paths: string[]) => {
      const message = composeMessage(raw);
      if (
        (!message.trim() && paths.length === 0) ||
        sendingRef.current ||
        sending ||
        !ptyExists
      ) {
        return false;
      }

      sendingRef.current = true;
      setSending(true);
      try {
        const sent = await sendSessionCanvasQuickInput(sessionId, message, paths, ptyIdHint);
        if (!sent) {
          toastManager.add({
            type: 'warning',
            title: t('Session not running'),
            description: t('Open the session with Ctrl+click to start its terminal first.'),
          });
          return false;
        }
        setValue('');
        setImagePaths([]);
        setMentionQuery(null);
        clearSupplement();
        return true;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [composeMessage, sending, sessionId, ptyExists, t, ptyIdHint, clearSupplement]
  );

  const handleSend = useCallback(async () => {
    await deliverMessage(value, imagePaths);
  }, [deliverMessage, value, imagePaths]);

  const handleSendComposed = useCallback(
    async (message: string) => {
      await deliverMessage(message, imagePaths);
    },
    [deliverMessage, imagePaths]
  );

  const handleContinue = useCallback(async () => {
    if (sendingRef.current || sending || !ptyExists) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const sent = await sendSessionCanvasQuickInput(sessionId, continuePrompt, [], ptyIdHint);
      if (!sent) {
        toastManager.add({
          type: 'warning',
          title: t('Session not running'),
          description: t('Open the session with Ctrl+click to start its terminal first.'),
        });
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [continuePrompt, sending, sessionId, ptyExists, t, ptyIdHint]);

  const handleNormalChip = useCallback(
    (content: string) => {
      if (!content.trim()) {
        setSupplement('');
        return;
      }
      const trimmed = supplement.trim();
      if (!trimmed) {
        setSupplement(content);
        return;
      }
      if (trimmed.endsWith(content)) return;
      setSupplement(`${trimmed}\n\n${content}`);
    },
    [supplement, setSupplement]
  );

  const handleEnhance = useCallback(() => {
    const enhanced = buildSessionCanvasEnhanceMessage(value);
    if (!enhanced.trim()) return;
    void handleSendComposed(enhanced);
  }, [value, handleSendComposed]);

  const handlePlainSend = useCallback(() => {
    void handleSend();
  }, [handleSend]);

  const disabled = sending || checkingPty || !ptyExists;
  const hasConditionalText = conditionalPrompts.some((p) => {
    const template = p.currentState ? p.templateTrue : p.templateFalse;
    return Boolean(template?.trim());
  });
  const canSend =
    Boolean(value.trim() || imagePaths.length > 0 || supplement.trim() || hasConditionalText);

  const placeholder =
    claudeMode && cwd
      ? t('Send a Claude prompt… (@ file, paste or attach images)')
      : kind === 'agent'
        ? t('Send a prompt or command to this agent…')
        : t('Send a command to this shell…');

  return (
    <div
      className={cn('relative flex min-h-0 shrink-0 flex-col gap-1.5', className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {claudeMode && mentionQuery !== null && mentionResults.length > 0 ? (
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
        <p className="shrink-0 rounded-md border border-dashed border-border/80 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
          {t('Terminal not running — Ctrl+click to open this session first.')}
        </p>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 max-h-[min(46vh,340px)] flex-col gap-2 overflow-y-auto rounded-md',
          'border border-border/60 bg-muted/20 p-2'
        )}
      >
        {promptsEnabled && normalPrompts.length > 0 ? (
          <div className="shrink-0 space-y-1">
            <p className="text-[10px] font-medium text-foreground/90">{t('Quick templates')}</p>
            <div className="flex flex-wrap gap-1">
              {normalPrompts.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={disabled}
                  title={chip.description ?? chip.content}
                  className={cn(
                    'rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px]',
                    'text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    disabled && 'pointer-events-none opacity-50'
                  )}
                  onClick={() => handleNormalChip(chip.content)}
                >
                  {chip.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {promptsEnabled && conditionalPrompts.length > 0 ? (
          <div className="shrink-0 space-y-1">
            <p className="text-[10px] font-medium text-foreground/90">{t('Context append')}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {conditionalPrompts.map((prompt) => (
                <label
                  key={prompt.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5',
                    disabled && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <Switch
                    checked={prompt.currentState}
                    disabled={disabled}
                    onCheckedChange={(checked) => setConditionalState(prompt.id, checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-medium leading-tight">
                      {prompt.conditionText ?? prompt.name}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-snug text-muted-foreground line-clamp-2">
                      {getConditionalPromptDescription(prompt)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="shrink-0 space-y-1">
          <p className="text-[10px] font-medium text-foreground/90">
            {t('Supplementary note (optional)')}
          </p>
          <textarea
            value={supplement}
            rows={2}
            disabled={disabled}
            placeholder={t('Add supplementary notes here…')}
            className={cn(
              'max-h-24 min-h-[40px] w-full resize-y rounded-md border border-border/80',
              'bg-background/90 px-2.5 py-1.5 font-mono text-[11px] leading-snug',
              'placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              disabled && 'cursor-not-allowed opacity-60'
            )}
            onChange={(e) => setSupplement(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {imagePaths.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-1">
            {imagePaths.map((path, index) => (
              <div
                key={path}
                className="group relative h-10 w-10 overflow-hidden rounded border border-border/80"
              >
                <img src={toLocalFileUrl(path)} alt="" className="h-full w-full object-cover" />
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

        <textarea
          ref={textareaRef}
          value={value}
          rows={3}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'min-h-[72px] max-h-40 w-full shrink-0 resize-y rounded-md border border-border/80',
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
            if (!claudeMode) return;
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
            if (claudeMode && mentionQuery !== null && mentionResults.length > 0) {
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

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFileInputChange(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-[11px]"
            disabled={disabled}
            title={t('Attach file')}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            {t('Attach file')}
          </Button>
          {claudeMode ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-[11px]"
              disabled={disabled}
              onClick={() => void handlePickFiles()}
            >
              {t('Browse…')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 text-[11px]"
            disabled={disabled || !value.trim()}
            onClick={() => void handleEnhance()}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('Enhance')}
          </Button>
          {enableContinueReply ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-[11px]"
              disabled={disabled}
              onClick={() => void handleContinue()}
            >
              <Play className="h-3.5 w-3.5" />
              {t('Continue')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 text-[11px]"
            disabled={disabled || !canSend}
            onClick={() => void handlePlainSend()}
          >
            <Send className="h-3.5 w-3.5" />
            {t('Send')}
          </Button>
        </div>
      </div>

      <p className="shrink-0 text-[10px] text-muted-foreground/80">
        {claudeMode
          ? t('Enter to send · Shift+Enter for newline · @ to mention files')
          : t('Enter to send · Shift+Enter for newline')}
      </p>
    </div>
  );
}
