import type { SessionCanvasCustomPrompt, SessionCanvasPromptConfig } from '@/types/sessionCanvasPrompt';

const now = () => new Date().toISOString();

function normal(
  id: string,
  name: string,
  content: string,
  description: string,
  sortOrder: number
): SessionCanvasCustomPrompt {
  return {
    id,
    name,
    content,
    description,
    sortOrder,
    type: 'normal',
    currentState: false,
    createdAt: now(),
    updatedAt: now(),
  };
}

function conditional(
  id: string,
  name: string,
  conditionText: string,
  templateTrue: string,
  templateFalse: string,
  sortOrder: number,
  currentState = false
): SessionCanvasCustomPrompt {
  return {
    id,
    name,
    content: '',
    description: conditionText,
    sortOrder,
    type: 'conditional',
    conditionText,
    templateTrue,
    templateFalse,
    currentState,
    createdAt: now(),
    updatedAt: now(),
  };
}

/** Defaults mirrored from 寸止 `default_custom_prompts` + reply config. */
export const DEFAULT_SESSION_CANVAS_PROMPTS: SessionCanvasCustomPrompt[] = [
  normal('default_1', '✅Done', '结束当前对话', '请求AI结束工作', 1),
  normal('default_2', '🧹Clear', '', '清空输入框内容', 2),
  normal('default_3', '✨New Issue', 'ok，完美，新的需求or问题，', '准备新的需求or问题', 3),
  normal('default_4', '🧠Remember', '请记住，', '寸止的另一个工具，请记住', 4),
  normal(
    'default_5',
    '📝Summary And Restart',
    '本次对话的上下文已经太长了，我打算关掉并重新开一个新的会话。你有什么想对你的继任者说的，以便它能更好的理解你当前的工作并顺利继续？',
    '总结-开新会话',
    5
  ),
  normal(
    'default_6',
    '🔍Review And Plan',
    `请执行以下项目进度检查和规划任务：

1. **项目进度分析**：
   - 查看当前代码库状态，分析已完成的功能模块
   - 识别已完成、进行中和待开始的功能点

2. **里程碑确定**：
   - 基于当前进度和剩余工作量，定义清晰的里程碑节点
   - 为每个里程碑设定具体的完成标准和时间预期

3. **文档更新**（注意：仅更新现有文档，不创建新文档）：
   - 更新项目规划文档中的进度状态

4. **下一步工作规划**：
   - 提供3-5个具体的下一步行动项，按优先级排序

5. **反馈收集**：
   - 在完成分析后，使用寸止工具收集用户对进度评估和下一步计划的反馈`,
    '项目进度检查和规划任务',
    6
  ),
  conditional(
    'default_7',
    '是否生成总结性Markdown文档',
    '是否生成总结性Markdown文档',
    '✔️请记住，帮我生成总结性Markdown文档',
    '',
    7
  ),
  conditional(
    'default_8',
    '是否生成测试脚本',
    '是否生成测试脚本',
    '✔️请记住，帮我生成测试脚本',
    '',
    8
  ),
  conditional(
    'default_9',
    '是否主动编译',
    '是否主动编译',
    '✔️请记住，帮我编译',
    '',
    9
  ),
  conditional(
    'default_10',
    '是否主动运行',
    '是否主动运行',
    '✔️请记住，帮我运行',
    '',
    10
  ),
];

export const DEFAULT_SESSION_CANVAS_PROMPT_CONFIG: SessionCanvasPromptConfig = {
  promptsEnabled: true,
  maxPrompts: 50,
  prompts: DEFAULT_SESSION_CANVAS_PROMPTS,
  deletedDefaultPromptIds: [],
  reply: {
    enableContinueReply: true,
    continuePrompt: '请按照最佳实践继续',
  },
};

export const SESSION_CANVAS_ENHANCE_PROMPT_PREFIX = `Use the following prompt to optimize and enhance the context of the content in 《》, and return the enhanced result by calling the tool '寸止' after completion.Here is an instruction that I'd like to give you, but it needs to be improved. Rewrite and enhance this instruction to make it clearer, more specific, less ambiguous, and correct any mistakes. Reply immediately with your answer, even if you're not sure. Consider the context of our conversation history when enhancing the prompt. Reply with the following format:

### BEGIN RESPONSE ###
Here is an enhanced version of the original instruction that is more specific and clear:
<augment-enhanced-prompt>enhanced prompt goes here</augment-enhanced-prompt>

### END RESPONSE ###

Here is my original instruction:

《`;

export const SESSION_CANVAS_ENHANCE_PROMPT_SUFFIX = '》';
