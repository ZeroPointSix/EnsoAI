import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_CANVAS_PROMPT_CONFIG } from '@/lib/sessionCanvasPromptDefaults';
import { mergeWithDefaults } from '../sessionCanvasPromptStore';

describe('sessionCanvasPromptStore mergeWithDefaults', () => {
  it('does not restore a deleted default prompt during rehydration', () => {
    const merged = mergeWithDefaults({
      prompts: DEFAULT_SESSION_CANVAS_PROMPT_CONFIG.prompts.filter((p) => p.id !== 'default_7'),
      deletedDefaultPromptIds: ['default_7'],
    });

    expect(merged.prompts.some((p) => p.id === 'default_7')).toBe(false);
    expect(merged.prompts.some((p) => p.id === 'default_8')).toBe(true);
    expect(merged.deletedDefaultPromptIds).toEqual(['default_7']);
  });

  it('keeps all defaults removed when every default has a tombstone', () => {
    const allDefaultIds = DEFAULT_SESSION_CANVAS_PROMPT_CONFIG.prompts.map((p) => p.id);

    const merged = mergeWithDefaults({
      prompts: [],
      promptsEnabled: false,
      deletedDefaultPromptIds: allDefaultIds,
    });

    expect(merged.prompts).toHaveLength(0);
    expect(merged.promptsEnabled).toBe(false);
    expect(merged.deletedDefaultPromptIds).toEqual(allDefaultIds);
  });
});
