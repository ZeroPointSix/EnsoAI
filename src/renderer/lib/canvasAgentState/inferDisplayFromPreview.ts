import type { CanvasAgentDisplayState } from '@/components/canvas/CanvasAgentStatusDot';

const SPINNER_CHARS = '·✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❇❈❉❊❋✢✣✤✥✦✧✨⊛⊕⊙◉◎◍⁂⁕※⍟☼★☆✽';

function hasSpinnerLine(text: string): boolean {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const first = trimmed.charAt(0);
    if (!first || !SPINNER_CHARS.includes(first)) continue;
    const rest = trimmed.slice(1);
    if (rest.startsWith(' ') && rest.includes('…') && /\d|for|ing|process/i.test(rest)) {
      return true;
    }
  }
  return false;
}

function hasBlockedPrompt(lower: string, _raw: string): boolean {
  return (
    lower.includes('do you want to proceed?') ||
    lower.includes('would you like to proceed?') ||
    lower.includes('waiting for permission') ||
    lower.includes('do you want to allow this connection?') ||
    lower.includes('tab to amend') ||
    lower.includes('ctrl+e to explain')
  );
}

/** 从看板 preview 尾部推断 Agent 展示状态（Claude Code 为主） */
export function inferDisplayFromPreview(previewText: string | undefined): CanvasAgentDisplayState | null {
  if (!previewText?.trim()) return null;

  const tail = previewText.slice(-4000);
  const lower = tail.toLowerCase();

  if (hasBlockedPrompt(lower, tail)) return 'blocked';

  // Claude 空闲提示符旁常有 esc to interrupt — 表示等待输入，不是执行中
  if (/^❯\s*$/m.test(tail.trimEnd()) || /\n❯\s*$/m.test(tail)) {
    return null;
  }

  // 「Cooked/Crunched/Thought for Ns」是已结束的阶段行，留在 scrollback 里不能算仍在跑
  if (
    /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(tail) ||
    hasSpinnerLine(tail) ||
    /\bbloviat(?:ing)?\b/i.test(tail) ||
    /\bbloviat(?:ing)?(?:\s+for\s+\d+s)?\s*…/i.test(tail)
  ) {
    return 'working';
  }

  return null;
}
