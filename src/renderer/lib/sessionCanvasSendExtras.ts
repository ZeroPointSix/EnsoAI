export interface SessionCanvasQuickTemplate {
  id: string;
  label: string;
  /** Plain text inserted into supplement when chip is clicked */
  text: string;
}

export interface SessionCanvasContextToggle {
  id: string;
  label: string;
  description?: string;
  /** Plain text prepended on send when enabled */
  appendText: string;
  defaultEnabled: boolean;
}

const TOGGLE_STORAGE_KEY = 'ensoai.sessionCanvas.contextToggles';

export const SESSION_CANVAS_CONTINUE_PROMPT =
  '请按照当前上下文与最佳实践继续完成剩余工作，不要提前结束。';

export const DEFAULT_SESSION_CANVAS_QUICK_TEMPLATES: SessionCanvasQuickTemplate[] = [
  { id: 'done', label: 'Done ✅', text: 'Done' },
  { id: 'clear', label: 'Clear 🧹', text: 'Clear' },
  { id: 'new-issue', label: 'New Issue ✨', text: 'New Issue' },
  { id: 'remember', label: 'Remember 🧠', text: '请记住：' },
  { id: 'summary-restart', label: 'Summary And Restart 📝', text: 'Summary And Restart' },
  { id: 'review-plan', label: 'Review And Plan 🔍', text: 'Review And Plan' },
  { id: 'wait', label: '等待', text: '等待' },
];

export const DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES: SessionCanvasContextToggle[] = [
  {
    id: 'update-docs',
    label: '是否更新文档',
    description: '根据对话实际情况更新相关文档',
    appendText: '请根据本次对话的实际情况，更新 Workspace / Memary 等相关文档（如有必要）。',
    defaultEnabled: false,
  },
  {
    id: 'background-start',
    label: '后台启动',
    description: '使用新进程在后台启动，不占用前台',
    appendText: '如需启动进程，请使用后台方式（独立进程），不要长时间占用前台终端。',
    defaultEnabled: true,
  },
  {
    id: 'start-output',
    label: '启动输出',
    appendText: '启动后请输出简要状态说明，便于我在看板预览中确认。',
    defaultEnabled: false,
  },
  {
    id: 'enable-cunzhi',
    label: '开启寸止',
    description: '未明确结束前通过寸止 MCP 与用户确认',
    appendText:
      '在任务未明确完成前，需要通过寸止 MCP 与用户确认；用户说结束才可结束，不要自行收尾。',
    defaultEnabled: true,
  },
  {
    id: 'subagent',
    label: '子代理',
    appendText: '可以使用子代理并行处理可拆分的子任务，但由你汇总结果。',
    defaultEnabled: false,
  },
  {
    id: 'enter-plan',
    label: '进入 Plan',
    description: '仅在能显著提升质量时使用',
    appendText: '若问题复杂，先进入 Plan 模式梳理方案再执行；简单问题直接做。',
    defaultEnabled: false,
  },
];

export function loadContextToggleEnabled(): Record<string, boolean> {
  if (typeof localStorage === 'undefined') {
    return Object.fromEntries(
      DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES.map((t) => [t.id, t.defaultEnabled])
    );
  }
  try {
    const raw = localStorage.getItem(TOGGLE_STORAGE_KEY);
    if (!raw) {
      return Object.fromEntries(
        DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES.map((t) => [t.id, t.defaultEnabled])
      );
    }
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    const merged: Record<string, boolean> = {};
    for (const toggle of DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES) {
      merged[toggle.id] = parsed[toggle.id] ?? toggle.defaultEnabled;
    }
    return merged;
  } catch {
    return Object.fromEntries(
      DEFAULT_SESSION_CANVAS_CONTEXT_TOGGLES.map((t) => [t.id, t.defaultEnabled])
    );
  }
}

export function saveContextToggleEnabled(enabledById: Record<string, boolean>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TOGGLE_STORAGE_KEY, JSON.stringify(enabledById));
  } catch {
    // ignore quota errors
  }
}

/** Join enabled toggles + supplement + user body as plain text (no structured payload). */
export function composeSessionCanvasOutgoingMessage(
  body: string,
  options: {
    supplement?: string;
    toggles: SessionCanvasContextToggle[];
    enabledById: Record<string, boolean>;
  }
): string {
  const parts: string[] = [];

  for (const toggle of options.toggles) {
    if (!options.enabledById[toggle.id]) continue;
    const text = toggle.appendText.trim();
    if (text) parts.push(text);
  }

  const supplement = options.supplement?.trim();
  if (supplement) parts.push(supplement);

  const main = body.trim();
  if (main) parts.push(main);

  return parts.join('\n\n');
}
