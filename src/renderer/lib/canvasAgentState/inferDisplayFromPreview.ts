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

  if (
    lower.includes('esc to interrupt') ||
    lower.includes('ctrl+c to interrupt') ||
    /\bthought for \d+s\b/i.test(tail) ||
    /\bcrunched for \d+s\b/i.test(tail) ||
    /\bbloviat(?:ing)?(?:\s+for\s+\d+s)?\b/i.test(tail) ||
    /\bcooked for \d+s\b/i.test(tail) ||
    /[*✽✻]?\s*cooked for \d+s/i.test(tail) ||
    /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(tail) ||
    hasSpinnerLine(tail)
  ) {
    return 'working';
  }

  return null;
}
