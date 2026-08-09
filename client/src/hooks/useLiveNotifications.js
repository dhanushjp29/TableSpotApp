import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getSocket, disconnectSocket } from "../services/socket/socketService.js";
import { addNotification } from "../store/slices/notificationSlice.js";

export default function useLiveNotifications() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const handleNewNotification = (payload) => {
      const notification = payload?.notification;
      if (!notification) return;
      dispatch(addNotification(notification));
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
      disconnectSocket();
    };
  }, [dispatch, user]);
}
