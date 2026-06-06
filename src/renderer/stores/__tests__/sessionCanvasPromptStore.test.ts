import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_CANVAS_PROMPT_CONFIG } from '@/lib/sessionCanvasPromptDefaults';
import { composeSessionCanvasOutgoingMessage } from '@/lib/sessionCanvasComposeMessage';
import { mergeWithDefaults } from '../sessionCanvasPromptStore';

const LEGACY_DEFAULT_FALSE_TEMPLATES = [
  ['default_7', '❌请记住，不要生成总结性Markdown文档'],
  ['default_8', '❌请记住，不要生成测试脚本'],
  ['default_9', '❌请记住，不要编译，用户自己编译'],
  ['default_10', '❌请记住，不要运行，用户自己运行'],
] as const;

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

  it('cleans legacy negative false branches from persisted default prompts', () => {
    const merged = mergeWithDefaults({
      prompts: LEGACY_DEFAULT_FALSE_TEMPLATES.map(([id, templateFalse]) => {
        const legacyPrompt = DEFAULT_SESSION_CANVAS_PROMPT_CONFIG.prompts.find(
          (prompt) => prompt.id === id
        );
        expect(legacyPrompt).toBeDefined();
        return {
          ...legacyPrompt!,
          currentState: false,
          templateFalse,
        };
      }),
    });

    for (const [id, legacyTemplate] of LEGACY_DEFAULT_FALSE_TEMPLATES) {
      const prompt = merged.prompts.find((p) => p.id === id);
      expect(prompt?.templateFalse).toBe('');
      expect(prompt?.templateFalse).not.toBe(legacyTemplate);
    }

    const message = composeSessionCanvasOutgoingMessage('hello', {
      prompts: merged.prompts,
    });
    expect(message).toBe('hello');
    for (const [, legacyTemplate] of LEGACY_DEFAULT_FALSE_TEMPLATES) {
      expect(message).not.toContain(legacyTemplate);
    }
  });
});
