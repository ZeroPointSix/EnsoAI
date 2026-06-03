import {
  SESSION_CANVAS_ENHANCE_PROMPT_PREFIX,
  SESSION_CANVAS_ENHANCE_PROMPT_SUFFIX,
} from '@/lib/sessionCanvasPromptDefaults';
import type { SessionCanvasCustomPrompt } from '@/types/sessionCanvasPrompt';

function sortedPrompts(prompts: SessionCanvasCustomPrompt[]): SessionCanvasCustomPrompt[] {
  return [...prompts].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Conditional branch texts (always one per conditional prompt), then supplement, then body. */
export function composeSessionCanvasOutgoingMessage(
  body: string,
  options: {
    supplement?: string;
    prompts: SessionCanvasCustomPrompt[];
  }
): string {
  const parts: string[] = [];

  for (const prompt of sortedPrompts(options.prompts)) {
    if (prompt.type !== 'conditional') continue;
    const template = prompt.currentState ? prompt.templateTrue : prompt.templateFalse;
    const text = template?.trim();
    if (text) parts.push(text);
  }

  const supplement = options.supplement?.trim();
  if (supplement) parts.push(supplement);

  const main = body.trim();
  if (main) parts.push(main);

  return parts.join('\n\n');
}

export function buildSessionCanvasEnhanceMessage(userInput: string): string {
  const trimmed = userInput.trim();
  if (!trimmed) return '';
  return `${SESSION_CANVAS_ENHANCE_PROMPT_PREFIX}${trimmed}${SESSION_CANVAS_ENHANCE_PROMPT_SUFFIX}`;
}

export function getConditionalPromptDescription(prompt: SessionCanvasCustomPrompt): string {
  if (prompt.type !== 'conditional') return prompt.description ?? '';
  const template = prompt.currentState ? prompt.templateTrue : prompt.templateFalse;
  if (template?.trim()) return template.trim();
  return prompt.description ?? prompt.conditionText ?? '';
}
