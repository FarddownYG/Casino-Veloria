import { Socket } from 'socket.io';
import { TokenService } from '../token/token.service';

export interface WsUser {
  userId: string;
  username: string;
  role: string;
}

export function extractToken(client: Socket): string | undefined {
  const fromAuth = client.handshake.auth?.token;
  const fromHeader = client.handshake.headers?.authorization;
  const raw = fromAuth || fromHeader;
  if (!raw) return undefined;
  return String(raw).replace(/^Bearer\s+/i, '').trim();
}

/** Verifies the handshake token and returns the user, or null if invalid. */
export function authenticateSocket(
  client: Socket,
  tokens: TokenService,
): WsUser | null {
  const token = extractToken(client);
  if (!token) return null;
  try {
    const payload = tokens.verifyAccess(token);
    return { userId: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}
