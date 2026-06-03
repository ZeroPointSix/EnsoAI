import { Play, Send, Sparkles } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import {
  buildSessionCanvasEnhanceMessage,
  getConditionalPromptDescription,
} from '@/lib/sessionCanvasComposeMessage';
import { cn } from '@/lib/utils';
import {
  selectConditionalPrompts,
  selectNormalPrompts,
  useSessionCanvasPromptStore,
} from '@/stores/sessionCanvasPromptStore';
import { useSessionCanvasSend } from './SessionCanvasSendContext';

interface SessionCanvasSendExtrasProps {
  disabled?: boolean;
  onSend: (message: string) => void | Promise<void>;
  onContinue: () => void | Promise<void>;
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
  const { supplement, setSupplement, composeMessage } = useSessionCanvasSend();
  const promptsEnabled = useSessionCanvasPromptStore((s) => s.promptsEnabled);
  const prompts = useSessionCanvasPromptStore((s) => s.prompts);
  const setConditionalState = useSessionCanvasPromptStore((s) => s.setConditionalState);
  const enableContinueReply = useSessionCanvasPromptStore((s) => s.reply.enableContinueReply);

  const normalPrompts = selectNormalPrompts(prompts);
  const conditionalPrompts = selectConditionalPrompts(prompts);

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
    const enhanced = buildSessionCanvasEnhanceMessage(mainBody);
    if (!enhanced.trim()) return;
    void onSend(enhanced);
  }, [mainBody, onSend]);

  const handlePlainSend = useCallback(() => {
    const composed = composeMessage(mainBody);
    if (!composed.trim()) return;
    void onSend(composed);
  }, [composeMessage, mainBody, onSend]);

  const hasConditionalText = conditionalPrompts.some((p) => {
    const template = p.currentState ? p.templateTrue : p.templateFalse;
    return Boolean(template?.trim());
  });

  const canSend =
    canSendMain || Boolean(supplement.trim()) || hasConditionalText;

  return (
    <div
      className={cn('flex flex-col gap-2 rounded-md border border-border/60 bg-muted/20 p-2', className)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {promptsEnabled && normalPrompts.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-foreground/90">{t('Supplementary note (optional)')}</p>
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
        <div className="space-y-1">
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
          disabled={disabled || !mainBody.trim()}
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
            onClick={() => void onContinue()}
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
  );
}
