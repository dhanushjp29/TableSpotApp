import { io } from "socket.io-client";
import { SOCKET_URL } from "../../config/runtime.js";


let socket = null;
const subscriptions = new Map();
let hasConnected = false;

const subscriptionKey = (type, restaurantId) =>
  `${type}:${restaurantId && restaurantId !== "all" ? restaurantId : "all"}`;

const emitSubscription = ({ type, restaurantId }) => {
  if (!socket) return;

  socket.emit(`subscribe:${type}`, {
    restaurantId:
      restaurantId && restaurantId !== "all" ? restaurantId : undefined,
  });
};

const restoreSubscriptions = () => {
  subscriptions.forEach((subscription) => {
    emitSubscription(subscription);
    subscription.onReconnect?.();
  });
};

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.on("connect", () => {
      if (hasConnected) {
        // Socket.IO rooms are connection-scoped. Rejoin them and refresh from
        // the API so missed events never become the client-side truth.
        restoreSubscriptions();
      }
      hasConnected = true;
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

const subscribe = ({ type, restaurantId, handler, onReconnect }) => {
  const s = ensureSocketConnected();
  const eventName = type === "bookings" ? "booking:updated" : "table:updated";
  const key = subscriptionKey(type, restaurantId);
  const existing = subscriptions.get(key) || {
    type,
    restaurantId,
    handlers: new Set(),
    onReconnect: null,
  };
  existing.handlers.add(handler);
  existing.onReconnect = onReconnect || existing.onReconnect;
  subscriptions.set(key, existing);

  emitSubscription(existing);
  s.off(eventName, handler);
  s.on(eventName, handler);

  return () => {
    s.off(eventName, handler);
    const current = subscriptions.get(key);
    if (!current) return;
    current.handlers.delete(handler);
    if (current.handlers.size === 0) {
      subscriptions.delete(key);
    }
  };
};

export function subscribeToBookingUpdates(restaurantId, handler, onReconnect) {
  return subscribe({ type: "bookings", restaurantId, handler, onReconnect });
}

export function subscribeToTableUpdates(restaurantId, handler, onReconnect) {
  return subscribe({ type: "tables", restaurantId, handler, onReconnect });
}

/**
 * Subscribe to reconciliation status updates. The backend emits
 * `payment:reconciliationUpdated` to the `restaurant_<id>` and `user_<id>`
 * rooms, so the caller must be joined to the relevant room to receive it.
 * Returns an unsubscribe function. Duplicate listeners are removed before
 * adding, so re-subscribing never stacks handlers.
 */
export function subscribeToReconciliationUpdates(handler) {
  const s = ensureSocketConnected();
  s.off("payment:reconciliationUpdated", handler);
  s.on("payment:reconciliationUpdated", handler);
  return () => {
    s.off("payment:reconciliationUpdated", handler);
  };
}
