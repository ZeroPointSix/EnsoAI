export interface PersistableAgentSession {
  remoteHost?: string;
  agentCommand?: string;
  activated?: boolean;
}

export function shouldPersistAgentSession(session: PersistableAgentSession): boolean {
  if (session.remoteHost) return true;
  return Boolean(session.activated && session.agentCommand?.startsWith('claude'));
}
