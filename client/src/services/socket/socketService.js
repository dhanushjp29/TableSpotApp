import { io } from "socket.io-client";
import { SOCKET_URL } from "../../config/runtime.js";


let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true,
    });
  }
  return socket;
}

export function ensureSocketConnected() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function connectSocket(token) {
  const s = getSocket();
  if (token) {
    s.auth = { token };
  }
  ensureSocketConnected();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function subscribeToBookingUpdates(restaurantId, handler) {
  const s = ensureSocketConnected();
  s.emit("subscribe:bookings", {
    restaurantId: restaurantId && restaurantId !== "all" ? restaurantId : undefined,
  });
  s.off("booking:updated", handler);
  s.on("booking:updated", handler);
  return () => {
    s.off("booking:updated", handler);
  };
}

export function subscribeToTableUpdates(restaurantId, handler) {
  const s = ensureSocketConnected();
  s.emit("subscribe:tables", {
    restaurantId: restaurantId && restaurantId !== "all" ? restaurantId : undefined,
  });
  s.off("table:updated", handler);
  s.on("table:updated", handler);
  return () => {
    s.off("table:updated", handler);
  };
}
