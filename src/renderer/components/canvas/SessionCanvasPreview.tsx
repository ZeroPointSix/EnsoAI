import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { defaultDarkTheme, getXtermTheme } from '@/lib/ghosttyTheme';
import { isPreviewStickToBottom } from '@/lib/previewStickToBottom';
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
 * Auto-scrolls only while the user is already near the bottom (same idea as CodeReviewModal / OpenCove scroll preservation).
 */
export function SessionCanvasPreview({
  text,
  placeholder,
  isActive = true,
  className,
}: SessionCanvasPreviewProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
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

  const syncStickState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = isPreviewStickToBottom(el.scrollTop, el.scrollHeight, el.clientHeight);
    stickToBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom && el.scrollHeight > el.clientHeight);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    if (!isActive || !hasText) return;
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setShowScrollToBottom(false);
  }, [text, isActive, hasText]);

  const handleScroll = useCallback(() => {
    syncStickState();
  }, [syncStickState]);

  return (
    <div
      className={cn(
        'relative flex min-h-[100px] flex-1 flex-col overflow-hidden rounded-md border border-border/60',
        className
      )}
      style={{ backgroundColor: colors.background }}
    >
      <div
        ref={scrollRef}
        className="h-full min-h-0 flex-1 overflow-auto px-2.5 py-2"
        onScroll={handleScroll}
      >
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
      {hasText && showScrollToBottom && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute bottom-2 right-2 z-10 h-7 w-7 shadow-md"
          title={t('Scroll to bottom')}
          aria-label={t('Scroll to bottom')}
          onClick={(e) => {
            e.stopPropagation();
            scrollToBottom();
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
