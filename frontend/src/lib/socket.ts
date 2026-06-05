import { io, type Socket } from 'socket.io-client';
import { API_URL } from './env';
import { getAccessToken } from '@/store/auth';

export type SocketNamespace =
  | '/user'
  | '/lobby'
  | '/roulette'
  | '/blackjack'
  | '/poker';

/**
 * Create a Socket.IO connection to a namespace, authenticating with the
 * current access token. The token is read lazily on (re)connect so refreshed
 * tokens are picked up automatically.
 */
export function createSocket(namespace: SocketNamespace): Socket {
  const socket = io(`${API_URL}${namespace}`, {
    transports: ['websocket'],
    autoConnect: true,
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
  });

  // Refresh the handshake auth with the latest token before each reconnect.
  socket.io.on('reconnect_attempt', () => {
    socket.auth = { token: getAccessToken() ?? '' };
  });

  return socket;
}
