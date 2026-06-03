import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import type { SessionCanvasCustomPrompt, SessionCanvasPromptType } from '@/types/sessionCanvasPrompt';
import { useSessionCanvasPromptStore } from '@/stores/sessionCanvasPromptStore';

interface PromptFormState {
  name: string;
  description: string;
  type: SessionCanvasPromptType;
  content: string;
  conditionText: string;
  templateTrue: string;
  templateFalse: string;
  currentState: boolean;
}

const emptyForm = (): PromptFormState => ({
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
}

export function SessionCanvasPromptSettings({ className }: SessionCanvasPromptSettingsProps) {
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
  const [form, setForm] = useState<PromptFormState>(emptyForm);

  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => a.sortOrder - b.sortOrder),
    [prompts]
  );

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
    <div className={cn('flex flex-col gap-4 overflow-y-auto p-4', className)}>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{t('Prompt templates')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('Manage quick templates and context append — same model as 寸止')}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <div>
          <p className="text-xs font-medium">{t('Enable quick templates')}</p>
          <p className="text-[10px] text-muted-foreground">{t('Show chips and context switches on canvas cards')}</p>
        </div>
        <Switch checked={promptsEnabled} onCheckedChange={setPromptsEnabled} />
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-3">
        <p className="text-xs font-medium">{t('Continue reply')}</p>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-muted-foreground">{t('Show Continue button')}</Label>
          <Switch
            checked={reply.enableContinueReply}
            onCheckedChange={(checked) => setReplyConfig({ enableContinueReply: checked })}
          />
        </div>
        {reply.enableContinueReply ? (
          <div className="space-y-1">
            <Label className="text-[11px]">{t('Continue prompt')}</Label>
            <Textarea
              value={reply.continuePrompt}
              rows={2}
              className="text-xs"
              onChange={(e) => setReplyConfig({ continuePrompt: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">
              {t('Plain text sent when you press Continue (no toggles or supplement)')}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t('{{count}} templates created', { count: prompts.length })}
        </p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={resetToDefaults}>
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

      <div className="space-y-2">
        {sortedPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{prompt.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {prompt.type === 'conditional' ? t('Context append') : t('Quick template')}
                  </span>
                </div>
                {prompt.description ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{prompt.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openEdit(prompt)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deletePrompt(prompt.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted/40 px-2 py-1.5 font-mono text-[10px] leading-snug text-foreground/90 whitespace-pre-wrap">
              {prompt.type === 'conditional' ? (
                <>
                  <span className="text-muted-foreground">{t('On')}: </span>
                  {prompt.templateTrue || '—'}
                  {'\n'}
                  <span className="text-muted-foreground">{t('Off')}: </span>
                  {prompt.templateFalse || '—'}
                </>
              ) : prompt.content.trim() ? (
                prompt.content
              ) : (
                <span className="text-muted-foreground italic">{t('(empty — clears supplement)')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t('Edit template') : t('Add template')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t('Name')}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('Description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.type === 'normal' ? 'default' : 'outline'}
                onClick={() => setForm((f) => ({ ...f, type: 'normal' }))}
              >
                {t('Quick template')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.type === 'conditional' ? 'default' : 'outline'}
                onClick={() => setForm((f) => ({ ...f, type: 'conditional' }))}
              >
                {t('Context append')}
              </Button>
            </div>
            {form.type === 'normal' ? (
              <div className="space-y-1">
                <Label>{t('Content')}</Label>
                <Textarea
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>{t('Condition label')}</Label>
                  <Input
                    value={form.conditionText}
                    onChange={(e) => setForm((f) => ({ ...f, conditionText: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('When ON (append on send)')}</Label>
                  <Textarea
                    rows={2}
                    value={form.templateTrue}
                    onChange={(e) => setForm((f) => ({ ...f, templateTrue: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('When OFF (append on send)')}</Label>
                  <Textarea
                    rows={2}
                    value={form.templateFalse}
                    onChange={(e) => setForm((f) => ({ ...f, templateFalse: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('Default switch state')}</Label>
                  <Switch
                    checked={form.currentState}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, currentState: checked }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={handleSave}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
