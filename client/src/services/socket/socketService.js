import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socket;
}

export function connectSocket(token) {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function subscribeToBookingUpdates(restaurantId, handler) {
  const s = getSocket();
  s.emit("subscribe:bookings", { restaurantId });
  s.off("booking:updated", handler);
  s.on("booking:updated", handler);
  return () => {
    s.off("booking:updated", handler);
  };
}

export function subscribeToTableUpdates(restaurantId, handler) {
  const s = getSocket();
  s.emit("subscribe:tables", { restaurantId });
  s.off("table:updated", handler);
  s.on("table:updated", handler);
  return () => {
    s.off("table:updated", handler);
  };
}
