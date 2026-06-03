import { Play, Send, Sparkles } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import {
  DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES,
  DEFAULT_SESSION_CANVAS_QUICK_TEMPLATES,
} from '@/lib/sessionCanvasSendExtras';
import { cn } from '@/lib/utils';
import { useSessionCanvasSend } from './SessionCanvasSendContext';

interface SessionCanvasSendExtrasProps {
  disabled?: boolean;
  onSend: (message: string) => void | Promise<void>;
  onContinue: () => void | Promise<void>;
  /** When set, primary row sends this text (main prompt textarea). */
  mainBody?: string;
  canSendMain?: boolean;
  className?: string;
}

export function SessionCanvasSendExtras({
  disabled = false,
  onSend,
  onContinue,
  mainBody = '',
  canSendMain = false,
  className,
}: SessionCanvasSendExtrasProps) {
  const { t } = useI18n();
  const { supplement, setSupplement, enabledById, setToggleEnabled, composeMessage } =
    useSessionCanvasSend();

  const appendTemplate = useCallback(
    (text: string) => {
      const trimmed = supplement.trim();
      if (!trimmed) {
        setSupplement(text);
        return;
      }
      if (trimmed.endsWith(text)) return;
      setSupplement(`${trimmed}\n\n${text}`);
    },
    [supplement, setSupplement]
  );

  const handleEnhanceSend = useCallback(() => {
    const composed = composeMessage(mainBody);
    if (!composed.trim()) return;
    void onSend(composed);
  }, [composeMessage, mainBody, onSend]);

  const handlePlainSend = useCallback(() => {
    const composed = composeMessage(mainBody);
    if (!composed.trim()) return;
    void onSend(composed);
  }, [composeMessage, mainBody, onSend]);

  const handleContinue = useCallback(() => {
    void onContinue();
  }, [onContinue]);

  const canSend =
    canSendMain ||
    Boolean(supplement.trim()) ||
    DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES.some((toggle) => enabledById[toggle.id]);

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 p-2', className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-foreground/90">{t('Supplementary note (optional)')}</p>
        <div className="flex flex-wrap gap-1">
          {DEFAULT_SESSION_CANVAS_QUICK_TEMPLATES.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              className={cn(
                'rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px]',
                'text-muted-foreground hover:border-primary/40 hover:text-foreground',
                disabled && 'pointer-events-none opacity-50'
              )}
              onClick={() => appendTemplate(chip.text)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-medium text-foreground/90">{t('Context append')}</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES.map((toggle) => (
            <label
              key={toggle.id}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md border border-border/50 bg-background/60 px-2 py-1.5',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <Switch
                checked={Boolean(enabledById[toggle.id])}
                disabled={disabled}
                onCheckedChange={(checked) => setToggleEnabled(toggle.id, checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-medium leading-tight">{toggle.label}</span>
                {toggle.description ? (
                  <span className="mt-0.5 block text-[9px] leading-snug text-muted-foreground">
                    {toggle.description}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>

      <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[9px] text-amber-800 dark:text-amber-200/90">
        {t('Tip: paste images in the prompt box below (Ctrl+V)')}
      </p>

      <textarea
        value={supplement}
        rows={3}
        disabled={disabled}
        placeholder={t('Add supplementary notes here…')}
        className={cn(
          'min-h-[56px] max-h-32 w-full resize-y rounded-md border border-border/80',
          'bg-background/90 px-2.5 py-2 font-mono text-[11px] leading-snug',
          'placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        onChange={(e) => setSupplement(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-1 text-[11px]"
          disabled={disabled || !canSend}
          onClick={() => void handleEnhanceSend()}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('Enhance')}
        </Button>
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
  );
}
