import type {
  RemoteAgentConnectionMode,
  RemoteAgentErrorCode,
  RemoteAgentMuxBackend,
} from '@shared/types';

export interface PersistableAgentSession {
  remoteHost?: string;
  agentCommand?: string;
  activated?: boolean;
}

export function shouldPersistAgentSession(session: PersistableAgentSession): boolean {
  if (session.remoteHost) return true;
  return Boolean(session.activated && session.agentCommand?.startsWith('claude'));
}

export function shouldRenderPtyOutput(remoteHost?: string): boolean {
  return !remoteHost?.trim();
}

export function getRemoteAgentConnectionMode(
  backend?: RemoteAgentMuxBackend
): RemoteAgentConnectionMode {
  return backend ? 'attach' : 'launch';
}

export function isRemoteAgentConnectionError(code: RemoteAgentErrorCode): boolean {
  return (
    code === 'ssh-failed' ||
    code === 'auth-failed' ||
    code === 'host-unreachable' ||
    code === 'host-key-failed'
  );
}
