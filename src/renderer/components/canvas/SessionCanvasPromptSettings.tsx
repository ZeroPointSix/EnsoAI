import { ArrowLeft, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toastManager } from '@/components/ui/toast';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SessionCanvasCustomPrompt } from '@/types/sessionCanvasPrompt';
import { useSessionCanvasPromptStore } from '@/stores/sessionCanvasPromptStore';
import {
  SessionCanvasPromptTemplateDialog,
  type PromptTemplateFormState,
} from './SessionCanvasPromptTemplateDialog';

const emptyForm = (): PromptTemplateFormState => ({
  name: '',
  description: '',
  type: 'normal',
  content: '',
  conditionText: '',
  templateTrue: '',
  templateFalse: '',
  currentState: false,
});

interface SessionCanvasPromptSettingsProps {
  className?: string;
  onBack?: () => void;
}

export function SessionCanvasPromptSettings({ className, onBack }: SessionCanvasPromptSettingsProps) {
  const { t } = useI18n();
  const promptsEnabled = useSessionCanvasPromptStore((s) => s.promptsEnabled);
  const setPromptsEnabled = useSessionCanvasPromptStore((s) => s.setPromptsEnabled);
  const prompts = useSessionCanvasPromptStore((s) => s.prompts);
  const maxPrompts = useSessionCanvasPromptStore((s) => s.maxPrompts);
  const reply = useSessionCanvasPromptStore((s) => s.reply);
  const setReplyConfig = useSessionCanvasPromptStore((s) => s.setReplyConfig);
  const addPrompt = useSessionCanvasPromptStore((s) => s.addPrompt);
  const updatePrompt = useSessionCanvasPromptStore((s) => s.updatePrompt);
  const deletePrompt = useSessionCanvasPromptStore((s) => s.deletePrompt);
  const resetToDefaults = useSessionCanvasPromptStore((s) => s.resetToDefaults);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromptTemplateFormState>(emptyForm);

  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => a.sortOrder - b.sortOrder),
    [prompts]
  );

  const normalCount = sortedPrompts.filter((p) => p.type === 'normal' || !p.type).length;
  const conditionalCount = sortedPrompts.filter((p) => p.type === 'conditional').length;

  const openAdd = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((prompt: SessionCanvasCustomPrompt) => {
    setEditingId(prompt.id);
    setForm({
      name: prompt.name,
      description: prompt.description ?? '',
      type: prompt.type,
      content: prompt.content,
      conditionText: prompt.conditionText ?? '',
      templateTrue: prompt.templateTrue ?? '',
      templateFalse: prompt.templateFalse ?? '',
      currentState: prompt.currentState,
    });
    setDialogOpen(true);
  }, []);

  const handleDeletePrompt = useCallback(
    (prompt: SessionCanvasCustomPrompt) => {
      const isLast = prompts.length === 1;
      deletePrompt(prompt.id);
      if (isLast) {
        toastManager.add({
          type: 'info',
          title: t('Templates cleared'),
          description: t('Quick templates disabled on canvas. Tap Load 寸止 defaults to restore.'),
        });
      }
    },
    [deletePrompt, prompts.length, t]
  );

  const handleSave = useCallback(() => {
    if (!form.name.trim()) return;
    if (form.type === 'conditional') {
      if (!form.conditionText.trim()) return;
      if (!form.templateTrue.trim() && !form.templateFalse.trim()) return;
    }

    const now = new Date().toISOString();
    if (editingId) {
      const existing = prompts.find((p) => p.id === editingId);
      if (!existing) return;
      updatePrompt({
        ...existing,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        content: form.type === 'normal' ? form.content : '',
        conditionText: form.type === 'conditional' ? form.conditionText.trim() : undefined,
        templateTrue: form.type === 'conditional' ? form.templateTrue.trim() || undefined : undefined,
        templateFalse: form.type === 'conditional' ? form.templateFalse.trim() || undefined : undefined,
        currentState: form.type === 'conditional' ? form.currentState : false,
        updatedAt: now,
      });
    } else {
      if (prompts.length >= maxPrompts) return;
      addPrompt({
        id: `custom_${Date.now()}`,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        sortOrder: prompts.length + 1,
        type: form.type,
        content: form.type === 'normal' ? form.content : '',
        conditionText: form.type === 'conditional' ? form.conditionText.trim() : undefined,
        templateTrue: form.type === 'conditional' ? form.templateTrue.trim() || undefined : undefined,
        templateFalse: form.type === 'conditional' ? form.templateFalse.trim() || undefined : undefined,
        currentState: form.type === 'conditional' ? form.currentState : false,
      });
    }
    setDialogOpen(false);
  }, [addPrompt, editingId, form, maxPrompts, prompts, updatePrompt]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
        <div className="flex items-start gap-2">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 h-8 w-8 shrink-0"
              onClick={onBack}
              title={t('Back to canvas')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{t('Prompt templates')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('Manage quick templates and context append — same model as 寸止')}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <section className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-3">
            <p className="text-xs font-medium">{t('Canvas display')}</p>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">{t('Enable quick templates')}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t('Show chips and context switches on canvas cards')}
                </p>
              </div>
              <Switch checked={promptsEnabled} onCheckedChange={setPromptsEnabled} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3">
            <p className="text-xs font-medium">{t('Continue reply')}</p>
            <div className="flex items-center justify-between gap-3">
              <Label className="text-[11px] text-muted-foreground">{t('Enable continue reply')}</Label>
              <Switch
                checked={reply.enableContinueReply}
                onCheckedChange={(checked) => setReplyConfig({ enableContinueReply: checked })}
              />
            </div>
            {reply.enableContinueReply ? (
              <div className="space-y-1.5">
                <Label className="text-[11px]">{t('Continue prompt')}</Label>
                <Textarea
                  value={reply.continuePrompt}
                  rows={2}
                  className="resize-none text-xs"
                  placeholder={t('Continue prompt default')}
                  onChange={(e) => setReplyConfig({ continuePrompt: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  {t('Plain text sent when you press Continue (no toggles or supplement)')}
                </p>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">{t('Template list')}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t('{{count}} templates created', { count: prompts.length })}
                  {prompts.length > 0
                    ? ` · ${normalCount} ${t('Quick template')} · ${conditionalCount} ${t('Context append')}`
                    : null}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={resetToDefaults}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('Reset defaults')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={prompts.length >= maxPrompts}
                  onClick={openAdd}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('Add template')}
                </Button>
              </div>
            </div>

            {sortedPrompts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium">{t('No templates yet')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('Includes 6 quick chips and 4 context switches.')}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-4 h-8 text-xs"
                  onClick={resetToDefaults}
                >
                  {t('Load 寸止 defaults')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPrompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="rounded-lg border border-border/70 bg-background/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{prompt.name}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px]',
                              prompt.type === 'conditional'
                                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                                : 'bg-primary/10 text-primary'
                            )}
                          >
                            {prompt.type === 'conditional' ? t('Context append') : t('Quick template')}
                          </span>
                        </div>
                        {prompt.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{prompt.description}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(prompt)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeletePrompt(prompt)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-3 rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[10px] leading-snug text-foreground/90 whitespace-pre-wrap">
                      {prompt.type === 'conditional' ? (
                        <>
                          {t('When ON (append on send)')}: {prompt.templateTrue || '—'}
                          {' · '}
                          {t('When OFF (append on send)')}: {prompt.templateFalse || '—'}
                        </>
                      ) : prompt.content.trim() ? (
                        prompt.content
                      ) : (
                        <span className="italic text-muted-foreground">
                          {t('(empty — clears supplement)')}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <SessionCanvasPromptTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={Boolean(editingId)}
        form={form}
        onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onSave={handleSave}
      />
    </div>
  );
}
