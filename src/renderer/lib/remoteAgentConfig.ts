export interface RemoteAgentConfig {
  remoteHost?: string;
  remoteWorkspace?: string;
}

export function normalizeRemoteAgentConfig(
  remoteHost: string,
  remoteWorkspace: string
): RemoteAgentConfig {
  const normalizedHost = remoteHost.trim();
  if (!normalizedHost) {
    return { remoteHost: undefined, remoteWorkspace: undefined };
  }

  return {
    remoteHost: normalizedHost,
    remoteWorkspace: remoteWorkspace.trim() || '~',
  };
}

export function isRemoteAgentConfigured(config?: Pick<RemoteAgentConfig, 'remoteHost'>): boolean {
  return Boolean(config?.remoteHost?.trim());
}

export function canUseAgentLocallyOrRemotely(
  config: Pick<RemoteAgentConfig, 'remoteHost'> | undefined,
  locallyInstalled: boolean
): boolean {
  return locallyInstalled || isRemoteAgentConfigured(config);
}
