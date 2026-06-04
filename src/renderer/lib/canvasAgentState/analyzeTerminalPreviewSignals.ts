import { sessionCanvasLog, sessionCanvasLogThrottled, shortSessionId } from '@/lib/sessionCanvasLog';

/** 预览中断类型：blocked=红灯（授权/Ask），error=红灯（异常，与 blocked 同色） */
export type PreviewInterruptKind = 'none' | 'blocked' | 'error';

export type PreviewInterruptReason =
  | 'ansi_red'
  | 'ansi_red_error_text'
  | 'numbered_menu'
  | 'permission_text'
  | 'ask_text'
  | 'error_text'
  | 'none';

export interface PreviewInterruptSignal {
  kind: PreviewInterruptKind;
  reason: PreviewInterruptReason;
  flags: {
    ansiRed: boolean;
    numberedMenu: boolean;
    permissionText: boolean;
    askText: boolean;
    errorText: boolean;
  };
  /** 用于日志的尾部样本（已去 ANSI，截断） */
  sampleLine?: string;
}

const RAW_TAIL_MAX_CHARS = 12_000;

/** 保留带 ANSI 的原始尾部，供颜色检测 */
export function appendRawPreviewTail(current: string | undefined, chunk: string): string {
  if (!chunk) return current ?? '';
  const merged = (current ?? '') + chunk;
  return merged.length > RAW_TAIL_MAX_CHARS ? merged.slice(-RAW_TAIL_MAX_CHARS) : merged;
}

/** 常见红色前景 SGR / 256 / RGB */
const RED_ANSI_PATTERNS: RegExp[] = [
  /\x1b\[(?:31|91)(?:[;m]|$)/,
  /\x1b\[38;5;(?:9|196|160|124|203)\b/,
  /\x1b\[38;2;\s*255\s*;\s*\d{1,3}\s*;\s*\d{1,3}\b/,
  /\x1b\[38;2;\s*\d{1,3}\s*;\s*0\s*;\s*0\b/,
];

const ERROR_TEXT_PATTERNS: RegExp[] = [
  /\berror\b/i,
  /\bexception\b/i,
  /\btraceback\b/i,
  /\bfailed\b/i,
  /\bfatal\b/i,
  /错误/,
  /异常/,
  /失败/,
];

const PERMISSION_TEXT_PATTERNS: RegExp[] = [
  /do you want to proceed\?/i,
  /would you like to proceed\?/i,
  /waiting for permission/i,
  /do you want to allow/i,
  /permission to/i,
  /allow this connection/i,
  /tab to amend/i,
  /ctrl\+e to explain/i,
  /是否允许/,
  /需要.*授权/,
  /请确认/,
  /允许.*吗/,
];

const ASK_TEXT_PATTERNS: RegExp[] = [
  /askuserquestion/i,
  /choose an option/i,
  /select one/i,
  /please choose/i,
  /请选择/,
  /请选择一个/,
];

/** 行首编号选项：1. / 2) / ❯ 1 等 */
const OPTION_LINE = /^(?:❯\s*)?([1-9])[.)]\s*\S/;

/** 仅包含单个数字 1–3 的行（用户描述的「连续 123」） */
const SOLO_DIGIT_LINE = /^[1-3]$/;

export function detectRedAnsiInRaw(rawTail: string | undefined): boolean {
  if (!rawTail?.trim()) return false;
  const tail = rawTail.slice(-6000);
  return RED_ANSI_PATTERNS.some((re) => re.test(tail));
}

/** 检测 1/2/3 连续编号菜单（授权、Ask 常见） */
export function detectNumberedChoiceMenu(strippedTail: string | undefined): boolean {
  if (!strippedTail?.trim()) return false;
  const lines = strippedTail
    .slice(-2500)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const recent = lines.slice(-20);

  // 连续单独数字行：1 → 2 → 3
  let soloStreak = 0;
  let lastSolo = 0;
  for (const line of recent) {
    if (SOLO_DIGIT_LINE.test(line)) {
      const n = Number(line);
      if (n === lastSolo + 1 || (lastSolo === 0 && n === 1)) {
        soloStreak++;
        lastSolo = n;
        if (soloStreak >= 2) return true;
      } else {
        soloStreak = 1;
        lastSolo = n;
      }
    } else if (!OPTION_LINE.test(line)) {
      soloStreak = 0;
      lastSolo = 0;
    }
  }

  // 标准 1. xxx / 2. xxx
  let optionStreak = 0;
  let lastOptionNum = 0;
  for (const line of recent) {
    const m = line.match(OPTION_LINE);
    if (m) {
      const n = Number(m[1]);
      if (n === lastOptionNum + 1 || (lastOptionNum === 0 && n === 1)) {
        optionStreak++;
        lastOptionNum = n;
        if (optionStreak >= 2) return true;
      } else {
        optionStreak = 1;
        lastOptionNum = n;
      }
    }
  }

  // 同一屏出现 1、2、3 开头的选项行各至少一行
  const starts = new Set<number>();
  for (const line of recent) {
    const m = line.match(OPTION_LINE);
    if (m) starts.add(Number(m[1]));
  }
  if (starts.has(1) && starts.has(2) && starts.has(3)) return true;

  return false;
}

function matchAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

export function inferPreviewInterruptSignal(input: {
  rawTail?: string;
  strippedTail?: string;
}): PreviewInterruptSignal {
  const stripped = input.strippedTail?.slice(-4000) ?? '';
  const lower = stripped.toLowerCase();
  const ansiRed = detectRedAnsiInRaw(input.rawTail);
  const numberedMenu = detectNumberedChoiceMenu(stripped);
  const permissionText = matchAny(lower, PERMISSION_TEXT_PATTERNS);
  const askText = matchAny(lower, ASK_TEXT_PATTERNS);
  const errorText = matchAny(stripped, ERROR_TEXT_PATTERNS);

  const flags = { ansiRed, numberedMenu, permissionText, askText, errorText };
  const sampleLine = stripped.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 120);

  if (ansiRed && errorText) {
    return { kind: 'error', reason: 'ansi_red_error_text', flags, sampleLine };
  }
  if (errorText && !numberedMenu && !permissionText) {
    return { kind: 'error', reason: 'error_text', flags, sampleLine };
  }
  if (ansiRed) {
    return { kind: 'blocked', reason: 'ansi_red', flags, sampleLine };
  }
  if (numberedMenu) {
    return { kind: 'blocked', reason: 'numbered_menu', flags, sampleLine };
  }
  if (permissionText) {
    return { kind: 'blocked', reason: 'permission_text', flags, sampleLine };
  }
  if (askText) {
    return { kind: 'blocked', reason: 'ask_text', flags, sampleLine };
  }

  return { kind: 'none', reason: 'none', flags, sampleLine };
}

/** 限流日志：每次 chunk 分析结果（仅当 flags 有命中或 kind 变化） */
export function logPreviewSignalAnalysis(
  sessionId: string,
  signal: PreviewInterruptSignal,
  meta?: { bytes?: number; phase?: string }
): void {
  const anyFlag = Object.values(signal.flags).some(Boolean);
  if (signal.kind === 'none' && !anyFlag) return;

  sessionCanvasLogThrottled(
    `preview-signal-${sessionId}-${signal.reason}`,
    2000,
    'PreviewSignal',
    'chunk analyzed',
    {
      sessionId: shortSessionId(sessionId),
      kind: signal.kind,
      reason: signal.reason,
      flags: signal.flags,
      ...meta,
    }
  );
}
