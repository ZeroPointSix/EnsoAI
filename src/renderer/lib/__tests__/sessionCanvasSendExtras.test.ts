import { describe, expect, it } from 'vitest';
import { composeSessionCanvasOutgoingMessage } from '../sessionCanvasComposeMessage';
import type { SessionCanvasCustomPrompt } from '../../types/sessionCanvasPrompt';

const conditionalPrompt = (
  id: string,
  currentState: boolean,
  templateTrue: string,
  templateFalse: string
): SessionCanvasCustomPrompt => ({
  id,
  name: id,
  content: '',
  sortOrder: 1,
  type: 'conditional',
  currentState,
  templateTrue,
  templateFalse,
  createdAt: '',
  updatedAt: '',
});

describe('composeSessionCanvasOutgoingMessage', () => {
  it('prepends conditional branch text, supplement, then body', () => {
    const prompts = [conditionalPrompt('a', true, '规则开', '规则关')];
    const result = composeSessionCanvasOutgoingMessage('用户主输入', {
      supplement: '补充一句',
      prompts,
    });
    expect(result).toBe('规则开\n\n补充一句\n\n用户主输入');
  });

  it('uses templateFalse when switch is off', () => {
    const prompts = [conditionalPrompt('a', false, '规则开', '规则关')];
    const result = composeSessionCanvasOutgoingMessage('only', { prompts });
    expect(result).toBe('规则关\n\nonly');
  });
});
