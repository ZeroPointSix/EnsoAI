import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

import type { SessionCanvasAgentDisplayState } from '@shared/types/sessionCanvas';

/** 看板 Agent 卡片四色状态（仅展示，由外部传入） */
export type CanvasAgentDisplayState = SessionCanvasAgentDisplayState;

const dotClass: Record<CanvasAgentDisplayState, string> = {
  idle: 'bg-zinc-400 dark:bg-zinc-500',
  working: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.7)]',
  blocked: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]',
  completed: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]',
};

const titleKeys: Record<CanvasAgentDisplayState, string> = {
  idle: 'Canvas agent idle',
  working: 'Canvas agent working',
  blocked: 'Canvas agent blocked',
  completed: 'Canvas agent completed',
};

interface CanvasAgentStatusDotProps {
  state: CanvasAgentDisplayState;
  className?: string;
}

/**
 * 看板 Agent 卡片状态灯：灰 / 黄 / 红 / 绿
 */
export function CanvasAgentStatusDot({ state, className }: CanvasAgentStatusDotProps) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
        dotClass[state],
        state === 'working' && 'animate-pulse',
        state === 'blocked' && 'ring-2 ring-red-500/30',
        className
      )}
      title={t(titleKeys[state])}
      aria-label={t(titleKeys[state])}
      role="status"
    />
  );
}

/** 图标容器左侧色条（简略卡扫视用） */
export function canvasAgentIconAccentClass(state: CanvasAgentDisplayState): string {
  switch (state) {
    case 'working':
      return 'ring-2 ring-yellow-500/50';
    case 'blocked':
      return 'ring-2 ring-red-500/50';
    case 'completed':
      return 'ring-2 ring-green-500/50';
    default:
      return '';
  }
}
