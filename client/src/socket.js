import { io } from 'socket.io-client';

let socketInstance = null;

/**
 * Returns the singleton Socket.IO client instance.
 * Automatically points to the current origin (port 3000 in dev and prod).
 */
export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected to server, ID:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });
  }

  return socketInstance;
}

/**
 * Get or create a persistent unique participant ID for this browser.
 * Ensures the one-vote-per-participant constraint is respected across page reloads.
 */
export function getOrCreateParticipantId() {
  const KEY = 'rt_polling_participant_id';
  let pid = localStorage.getItem(KEY);
  if (!pid) {
    pid = 'pid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem(KEY, pid);
  }
  return pid;
}

/**
 * Store admin tokens locally so admin can re-access their room
 */
export function saveAdminToken(roomCode, token) {
  if (!roomCode || !token) return;
  try {
    const key = `rt_polling_admin_${roomCode.toUpperCase()}`;
    localStorage.setItem(key, token);
  } catch (e) {
    console.error('Failed to save admin token:', e);
  }
}

export function getAdminToken(roomCode) {
  if (!roomCode) return null;
  try {
    const key = `rt_polling_admin_${roomCode.toUpperCase()}`;
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
