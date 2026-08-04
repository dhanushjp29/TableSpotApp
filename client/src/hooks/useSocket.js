import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import { addNotification, setSocketEvent } from "../store/slices/notificationSlice.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function useSocket() {
  const dispatch = useDispatch();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    if (!user) return undefined;

    // Socket authentication requires a token via handshake auth.
    // The access token is in an httpOnly cookie so it cannot be read by JS.
    // The socket will connect and the backend will handle auth.
    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socket.on("booking:created", (data) => {
      dispatch(
        addNotification({
          title: "New Reservation",
          message: "A new reservation has been created.",
          type: "Booking",
          data,
          isRead: false,
          createdAt: new Date().toISOString(),
        })
      );
      dispatch(setSocketEvent({ event: "booking:created", data }));
    });

    socket.on("booking:statusUpdated", (data) => {
      dispatch(
        addNotification({
          title: "Reservation Updated",
          message: "A reservation status has been updated.",
          type: "Booking",
          data,
          isRead: false,
          createdAt: new Date().toISOString(),
        })
      );
      dispatch(setSocketEvent({ event: "booking:statusUpdated", data }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, dispatch]);

  const joinRestaurantRoom = (restaurantId) => {
    socketRef.current?.emit("join:restaurant", restaurantId, (response) => {
      if (response?.error) {
        console.error("Failed to join restaurant room:", response.error);
      }
    });
  };

  const leaveRestaurantRoom = (restaurantId) => {
    socketRef.current?.emit("leave:restaurant", restaurantId);
  };

  return {
    isConnected,
    joinRestaurantRoom,
    leaveRestaurantRoom,
  };
}

export default useSocket;
