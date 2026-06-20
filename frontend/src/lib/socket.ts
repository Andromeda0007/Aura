import { io, type Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000";

let socket: Socket | null = null;

/** Connect to the Aura realtime server for a session (JWT in auth, session_id in query). */
export function connectSocket(sessionId: string, token: string): Socket {
  if (socket?.connected) socket.disconnect();
  socket = io(WS_URL, {
    transports: ["websocket"],
    auth: { token },
    query: { session_id: sessionId },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

/** Connect as a read-only student viewer using a session join code (no JWT). */
export function connectStudentSocket(joinCode: string): Socket {
  if (socket?.connected) socket.disconnect();
  socket = io(WS_URL, {
    transports: ["websocket"],
    auth: { role: "student", joinCode },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
