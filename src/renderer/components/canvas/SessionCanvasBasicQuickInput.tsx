import type { SessionCanvasCardKind } from '@shared/types/sessionCanvas';
import { Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toastManager } from '@/components/ui/toast';
import { useSessionCanvasPtyExists } from '@/hooks/useSessionCanvasPtyExists';
import { useI18n } from '@/i18n';
import { sendSessionCanvasQuickInput } from '@/lib/sessionCanvasQuickSend';
import { cn } from '@/lib/utils';

interface SessionCanvasBasicQuickInputProps {
  sessionId: string;
  kind: SessionCanvasCardKind;
  ptyIdHint?: string;
  className?: string;
}

export function SessionCanvasBasicQuickInput({
  sessionId,
  kind,
  ptyIdHint,
  className,
}: SessionCanvasBasicQuickInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { ptyExists, checkingPty } = useSessionCanvasPtyExists(sessionId, true, ptyIdHint);

  useEffect(() => {
    if (!ptyExists || checkingPty) return;
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [sessionId, ptyExists, checkingPty]);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sendingRef.current || sending || !ptyExists) return;

    sendingRef.current = true;
    setSending(true);
    try {
      const sent = await sendSessionCanvasQuickInput(sessionId, trimmed, [], ptyIdHint);
      if (!sent) {
        toastManager.add({
          type: 'warning',
          title: t('Session not running'),
          description: t('Open the session with Ctrl+click to start its terminal first.'),
        });
        return;
      }
      setValue('');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [value, sending, sessionId, ptyExists, t, ptyIdHint]);

  const placeholder =
    kind === 'agent'
      ? t('Send a prompt or command to this agent…')
      : t('Send a command to this shell…');

  const disabled = sending || checkingPty || !ptyExists;

  return (
    <div
      className={cn('flex shrink-0 flex-col gap-1.5', className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!checkingPty && !ptyExists ? (
        <p className="rounded-md border border-dashed border-border/80 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
          {t('Terminal not running — Ctrl+click to open this session first.')}
        </p>
      ) : null}
      <div className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={value}
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'min-h-[52px] max-h-28 min-w-0 flex-1 resize-y rounded-md border border-border/80',
            'bg-background/90 px-2.5 py-2 font-mono text-[11px] leading-snug',
            'placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'cursor-not-allowed opacity-60'
          )}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
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
          disabled={disabled || !value.trim()}
          title={t('Send')}
          aria-label={t('Send')}
          onClick={() => void handleSend()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/80">
        {t('Enter to send · Shift+Enter for newline')}
      </p>
    </div>
  );
}
