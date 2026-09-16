import type { SshHostConfig } from '@shared/types';
import { Cloud, LoaderCircle, RefreshCw, Search, Server } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface RemoteTerminalPickerProps {
  onSelect: (host: SshHostConfig) => void;
  showLabel?: boolean;
}

function hostDescription(host: SshHostConfig): string {
  const destination = host.hostname ?? host.alias;
  const address = host.user ? `${host.user}@${destination}` : destination;
  return host.port ? `${address}:${host.port}` : address;
}

export function RemoteTerminalPicker({ onSelect, showLabel = false }: RemoteTerminalPickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [hosts, setHosts] = useState<SshHostConfig[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setHosts(await window.electronAPI.terminal.listSshHosts());
    } catch (loadError) {
      setHosts([]);
      setError(loadError instanceof Error ? loadError.message : t('Failed to load SSH hosts'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      void loadHosts();
    }
  }, [open, loadHosts]);

  const filteredHosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return hosts;
    return hosts.filter((host) =>
      [host.alias, host.hostname, host.user]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [hosts, query]);

  if (window.electronAPI.env.platform !== 'win32') {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          'flex items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          showLabel ? 'h-8 gap-2 px-3 text-sm' : 'h-7 w-7'
        )}
        title={t('Remote Terminal')}
      >
        <Cloud className="h-4 w-4 shrink-0" />
        {showLabel && <span>{t('Remote Terminal')}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80" sideOffset={6}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <PopoverTitle className="text-sm">{t('SSH Hosts')}</PopoverTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => void loadHosts()}
              disabled={isLoading}
              title={t('Refresh')}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search SSH hosts')}
              className="h-8 pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {isLoading && hosts.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
              </div>
            ) : error ? (
              <p className="px-2 py-5 text-center text-sm text-destructive">{error}</p>
            ) : filteredHosts.length === 0 ? (
              <div className="px-2 py-5 text-center">
                <p className="text-sm text-muted-foreground">{t('No SSH hosts found')}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground/70">~/.ssh/config</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredHosts.map((host) => (
                  <button
                    key={host.alias}
                    type="button"
                    onClick={() => {
                      onSelect(host);
                      setOpen(false);
                    }}
                    className="flex min-w-0 items-center gap-2 rounded px-2 py-2 text-left hover:bg-accent"
                  >
                    <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{host.alias}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hostDescription(host)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
