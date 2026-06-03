import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SessionCanvasPromptType } from '@/types/sessionCanvasPrompt';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export interface PromptTemplateFormState {
  name: string;
  description: string;
  type: SessionCanvasPromptType;
  content: string;
  conditionText: string;
  templateTrue: string;
  templateFalse: string;
  currentState: boolean;
}

interface SessionCanvasPromptTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: PromptTemplateFormState;
  onFormChange: (patch: Partial<PromptTemplateFormState>) => void;
  onSave: () => void;
}

export function SessionCanvasPromptTemplateDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onSave,
}: SessionCanvasPromptTemplateDialogProps) {
  const { t } = useI18n();

  const canSave =
    Boolean(form.name.trim()) &&
    (form.type === 'normal' ||
      (form.conditionText.trim() && (form.templateTrue.trim() || form.templateFalse.trim())));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-[min(92vw,32rem)] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
          <DialogTitle>{editing ? t('Edit template') : t('Add template')}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1">
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-xs font-medium transition-colors',
                form.type === 'normal'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onFormChange({ type: 'normal' })}
            >
              {t('Quick template')}
            </button>
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-xs font-medium transition-colors',
                form.type === 'conditional'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onFormChange({ type: 'conditional' })}
            >
              {t('Context append')}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('Name')}</Label>
              <Input
                value={form.name}
                placeholder={t('Template name placeholder')}
                onChange={(e) => onFormChange({ name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('Description')}</Label>
              <Input
                value={form.description}
                placeholder={t('Template description placeholder')}
                onChange={(e) => onFormChange({ description: e.target.value })}
              />
            </div>
          </div>

          <div className="min-h-[280px] rounded-lg border border-border/60 bg-muted/15 p-3">
            {form.type === 'normal' ? (
              <div className="flex h-full min-h-[256px] flex-col gap-2">
                <div>
                  <Label className="text-xs">{t('Content')}</Label>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t('Chip click appends this text to the input box on the card.')}
                  </p>
                </div>
                <Textarea
                  className="min-h-0 flex-1 resize-none text-xs"
                  value={form.content}
                  placeholder={t('Template content placeholder')}
                  onChange={(e) => onFormChange({ content: e.target.value })}
                />
              </div>
            ) : (
              <div className="flex min-h-[256px] flex-col gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('Condition label')}</Label>
                  <Input
                    value={form.conditionText}
                    placeholder={t('Condition label placeholder')}
                    onChange={(e) => onFormChange({ conditionText: e.target.value })}
                  />
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="flex min-h-0 flex-col gap-1.5">
                    <Label className="text-xs">{t('When ON (append on send)')}</Label>
                    <Textarea
                      className="min-h-[88px] flex-1 resize-none text-xs"
                      value={form.templateTrue}
                      onChange={(e) => onFormChange({ templateTrue: e.target.value })}
                    />
                  </div>
                  <div className="flex min-h-0 flex-col gap-1.5">
                    <Label className="text-xs">{t('When OFF (append on send)')}</Label>
                    <Textarea
                      className="min-h-[88px] flex-1 resize-none text-xs"
                      value={form.templateFalse}
                      onChange={(e) => onFormChange({ templateFalse: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/70 px-3 py-2">
                  <Label className="text-xs">{t('Default switch state')}</Label>
                  <Switch
                    checked={form.currentState}
                    onCheckedChange={(checked) => onFormChange({ currentState: checked })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button type="button" disabled={!canSave} onClick={onSave}>
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
