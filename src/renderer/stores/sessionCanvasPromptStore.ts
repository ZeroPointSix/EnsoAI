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

function mergeWithDefaults(parsed: Partial<SessionCanvasPromptConfig>): SessionCanvasPromptConfig {
  const defaults = DEFAULT_SESSION_CANVAS_PROMPT_CONFIG;
  const defaultById = new Map(defaults.prompts.map((p) => [p.id, p]));
  const mergedPrompts: SessionCanvasCustomPrompt[] = [];

  const saved = parsed.prompts ?? [];
  for (const p of saved) {
    const def = defaultById.get(p.id);
    mergedPrompts.push(def ? { ...def, ...p, type: p.type ?? def.type } : p);
  }
  for (const def of defaults.prompts) {
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
  };
}

export const useSessionCanvasPromptStore = create<SessionCanvasPromptState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SESSION_CANVAS_PROMPT_CONFIG,

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
        set({ prompts: [...state.prompts, next] });
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
          if (next.length === 0) {
            return { prompts: [], promptsEnabled: false };
          }
          return { prompts: next };
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
        });
      },
    }),
    {
      name: 'ensoai.sessionCanvas.promptConfig',
      version: 2,
      migrate: (persisted) => {
        const parsed = (persisted ?? {}) as Partial<SessionCanvasPromptConfig>;
        return mergeWithDefaults(parsed);
      },
      merge: (persisted, current) => {
        const parsed = (persisted ?? {}) as Partial<SessionCanvasPromptConfig>;
        const merged = mergeWithDefaults(parsed);
        if (merged.prompts.length === 0) {
          return { ...current, ...mergeWithDefaults(DEFAULT_SESSION_CANVAS_PROMPT_CONFIG) };
        }
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
