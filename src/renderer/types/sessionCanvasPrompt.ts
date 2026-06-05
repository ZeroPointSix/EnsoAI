/** Aligns with 寸止 CustomPrompt — quick templates + conditional context append. */
export type SessionCanvasPromptType = 'normal' | 'conditional';

export interface SessionCanvasCustomPrompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  sortOrder: number;
  type: SessionCanvasPromptType;
  conditionText?: string;
  templateTrue?: string;
  templateFalse?: string;
  /** For conditional: which branch is active (true → templateTrue). */
  currentState: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCanvasReplyConfig {
  enableContinueReply: boolean;
  continuePrompt: string;
}

export interface SessionCanvasPromptConfig {
  promptsEnabled: boolean;
  maxPrompts: number;
  prompts: SessionCanvasCustomPrompt[];
  reply: SessionCanvasReplyConfig;
  /** Default prompt ids the user explicitly deleted; prevents rehydration from restoring them. */
  deletedDefaultPromptIds: string[];
}
