import { useEffect, useMemo, useRef } from 'react';
import { defaultDarkTheme, getXtermTheme } from '@/lib/ghosttyTheme';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';

interface SessionCanvasPreviewProps {
  text?: string;
  placeholder: string;
  isActive?: boolean;
  className?: string;
}

/**
 * Terminal-styled read-only preview for the session canvas.
 * Auto-scrolls to the latest output when text updates.
 */
export function SessionCanvasPreview({
  text,
  placeholder,
  isActive = true,
  className,
}: SessionCanvasPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const terminalTheme = useSettingsStore((s) => s.terminalTheme);
  const bgImageEnabled = useSettingsStore((s) => s.backgroundImageEnabled);

  const colors = useMemo(() => {
    const theme = getXtermTheme(terminalTheme) ?? defaultDarkTheme;
    if (bgImageEnabled) {
      return {
        background: 'oklch(0.145 0.014 285.82 / 0.92)',
        foreground: theme.foreground ?? defaultDarkTheme.foreground,
      };
    }
    return {
      background: theme.background ?? defaultDarkTheme.background,
      foreground: theme.foreground ?? defaultDarkTheme.foreground,
    };
  }, [terminalTheme, bgImageEnabled]);

  const hasText = Boolean(text?.trim());

  useEffect(() => {
    if (!isActive || !hasText) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text, isActive, hasText]);

  return (
    <div
      className={cn(
        'relative flex min-h-[140px] max-h-[min(480px,45vh)] flex-1 resize-y flex-col overflow-hidden rounded-md border border-border/60',
        className
      )}
      style={{ backgroundColor: colors.background }}
    >
      <div ref={scrollRef} className="h-full min-h-0 flex-1 overflow-auto px-2.5 py-2">
        {hasText ? (
          <pre
            className="whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.45] select-text"
            style={{ color: colors.foreground }}
          >
            {text}
          </pre>
        ) : (
          <p
            className="font-mono text-[11px] leading-[1.45] text-muted-foreground/70 italic"
            style={{ color: colors.foreground, opacity: 0.45 }}
          >
            {placeholder}
          </p>
        )}
      </div>
      {hasText && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-6"
          style={{
            background: `linear-gradient(to bottom, ${colors.background}, transparent)`,
          }}
        />
      )}
    </div>
  );
}
