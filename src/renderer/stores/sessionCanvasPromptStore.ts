import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SESSION_CANVAS_PROMPT_CONFIG } from '@/lib/sessionCanvasPromptDefaults';
import type {
  SessionCanvasCustomPrompt,
  SessionCanvasPromptConfig,
  SessionCanvasReplyConfig,
} from '@/types/sessionCanvasPrompt';

interface SessionCanvasPromptState extends SessionCanvasPromptConfig {
  setPromptsEnabled: (enabled: boolean) => void;
  setReplyConfig: (patch: Partial<SessionCanvasReplyConfig>) => void;
  setConditionalState: (promptId: string, currentState: boolean) => void;
  addPrompt: (prompt: Omit<SessionCanvasCustomPrompt, 'createdAt' | 'updatedAt'>) => void;
  updatePrompt: (prompt: SessionCanvasCustomPrompt) => void;
  deletePrompt: (promptId: string) => void;
  reorderPrompts: (orderedIds: string[]) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PROMPT_IDS = new Set(DEFAULT_SESSION_CANVAS_PROMPT_CONFIG.prompts.map((p) => p.id));
const LEGACY_DEFAULT_FALSE_TEMPLATES = new Map([
  ['default_7', '❌请记住，不要生成总结性Markdown文档'],
  ['default_8', '❌请记住，不要生成测试脚本'],
  ['default_9', '❌请记住，不要编译，用户自己编译'],
  ['default_10', '❌请记住，不要运行，用户自己运行'],
]);

function deletedDefaultPromptIdsFrom(
  parsed: Partial<SessionCanvasPromptConfig>,
  saved: SessionCanvasCustomPrompt[]
): string[] {
  if (Array.isArray(parsed.deletedDefaultPromptIds)) {
    const deleted = new Set(parsed.deletedDefaultPromptIds);
    return DEFAULT_SESSION_CANVAS_PROMPT_CONFIG.prompts
      .filter((prompt) => deleted.has(prompt.id))
      .map((prompt) => prompt.id);
  }

  if (!Array.isArray(parsed.prompts)) return [];

  const savedIds = new Set(saved.map((prompt) => prompt.id));
  return DEFAULT_SESSION_CANVAS_PROMPT_CONFIG.prompts
    .filter((prompt) => !savedIds.has(prompt.id))
    .map((prompt) => prompt.id);
}

function mergeDefaultPrompt(
  def: SessionCanvasCustomPrompt,
  saved: SessionCanvasCustomPrompt
): SessionCanvasCustomPrompt {
  const merged = { ...def, ...saved, type: saved.type ?? def.type };
  const legacyFalseTemplate = LEGACY_DEFAULT_FALSE_TEMPLATES.get(saved.id);
  if (legacyFalseTemplate && saved.templateFalse?.trim() === legacyFalseTemplate) {
    return { ...merged, templateFalse: def.templateFalse };
  }
  return merged;
}

export function mergeWithDefaults(
  parsed: Partial<SessionCanvasPromptConfig>
): SessionCanvasPromptConfig {
  const defaults = DEFAULT_SESSION_CANVAS_PROMPT_CONFIG;
  const defaultById = new Map(defaults.prompts.map((p) => [p.id, p]));
  const mergedPrompts: SessionCanvasCustomPrompt[] = [];

  const saved = parsed.prompts ?? [];
  const deletedDefaultPromptIds = deletedDefaultPromptIdsFrom(parsed, saved);
  const deletedDefaults = new Set(deletedDefaultPromptIds);
  for (const p of saved) {
    if (defaultById.has(p.id) && deletedDefaults.has(p.id)) continue;
    const def = defaultById.get(p.id);
    mergedPrompts.push(def ? mergeDefaultPrompt(def, p) : p);
  }
  for (const def of defaults.prompts) {
    if (deletedDefaults.has(def.id)) continue;
    if (!mergedPrompts.some((p) => p.id === def.id)) {
      mergedPrompts.push(def);
    }
  }
  mergedPrompts.sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    promptsEnabled: parsed.promptsEnabled ?? defaults.promptsEnabled,
    maxPrompts: parsed.maxPrompts ?? defaults.maxPrompts,
    prompts: mergedPrompts,
    reply: { ...defaults.reply, ...parsed.reply },
    deletedDefaultPromptIds,
  };
}

export const useSessionCanvasPromptStore = create<SessionCanvasPromptState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SESSION_CANVAS_PROMPT_CONFIG,
      deletedDefaultPromptIds: [],

      setPromptsEnabled: (enabled) => set({ promptsEnabled: enabled }),

      setReplyConfig: (patch) =>
        set((state) => ({
          reply: { ...state.reply, ...patch },
        })),

      setConditionalState: (promptId, currentState) =>
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.id === promptId ? { ...p, currentState, updatedAt: new Date().toISOString() } : p
          ),
        })),

      addPrompt: (prompt) => {
        const state = get();
        if (state.prompts.length >= state.maxPrompts) return;
        const now = new Date().toISOString();
        const next: SessionCanvasCustomPrompt = {
          ...prompt,
          createdAt: now,
          updatedAt: now,
        };
        set({
          prompts: [...state.prompts, next],
          deletedDefaultPromptIds: state.deletedDefaultPromptIds.filter((id) => id !== next.id),
        });
      },

      updatePrompt: (prompt) =>
        set((state) => ({
          prompts: state.prompts.map((p) =>
            p.id === prompt.id ? { ...prompt, updatedAt: new Date().toISOString() } : p
          ),
        })),

      deletePrompt: (promptId) =>
        set((state) => {
          const next = state.prompts.filter((p) => p.id !== promptId);
          const deletedDefaultPromptIds = DEFAULT_PROMPT_IDS.has(promptId)
            ? Array.from(new Set([...state.deletedDefaultPromptIds, promptId]))
            : state.deletedDefaultPromptIds;
          return {
            prompts: next,
            deletedDefaultPromptIds,
            ...(next.length === 0 ? { promptsEnabled: false } : {}),
          };
        }),

      reorderPrompts: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.prompts.map((p) => [p.id, p]));
          const reordered: SessionCanvasCustomPrompt[] = [];
          orderedIds.forEach((id, index) => {
            const p = byId.get(id);
            if (p) reordered.push({ ...p, sortOrder: index + 1 });
          });
          for (const p of state.prompts) {
            if (!orderedIds.includes(p.id)) reordered.push(p);
          }
          return { prompts: reordered };
        }),

      resetToDefaults: () => {
        const defaults = DEFAULT_SESSION_CANVAS_PROMPT_CONFIG;
        const now = new Date().toISOString();
        set({
          promptsEnabled: defaults.promptsEnabled,
          maxPrompts: defaults.maxPrompts,
          prompts: defaults.prompts.map((p) => ({
            ...p,
            createdAt: now,
            updatedAt: now,
          })),
          reply: { ...defaults.reply },
          deletedDefaultPromptIds: [],
        });
      },
    }),
    {
      name: 'ensoai.sessionCanvas.promptConfig',
      version: 4,
      migrate: (persisted) => {
        const parsed = (persisted ?? {}) as Partial<SessionCanvasPromptConfig>;
        return mergeWithDefaults(parsed);
      },
      merge: (persisted, current) => {
        const parsed = (persisted ?? {}) as Partial<SessionCanvasPromptConfig>;
        const merged = mergeWithDefaults(parsed);
        return { ...current, ...merged };
      },
    }
  )
);

export function selectNormalPrompts(prompts: SessionCanvasCustomPrompt[]): SessionCanvasCustomPrompt[] {
  return prompts
    .filter((p) => p.type === 'normal' || !p.type)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function selectConditionalPrompts(prompts: SessionCanvasCustomPrompt[]): SessionCanvasCustomPrompt[] {
  return prompts
    .filter((p) => p.type === 'conditional')
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
