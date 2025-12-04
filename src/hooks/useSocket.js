import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";
import { useAuthStore } from "../store/authStore";

/**
 * Connects admin to WebSocket and listens for:
 * - users_update : { [userId]: { lat, lng, name } }
 * - user_status  : { userId, status }
 */
export function useSocketLiveLocations() {
  const token = useAuthStore((s) => s.token);
  const [usersMap, setUsersMap] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("WS connected", socket.id);
    });

    socket.on("users_update", (payload) => {
      setUsersMap(payload || {});
    });

    socket.on("user_status", (data) => {
      console.log("User status event", data);
    });

    socket.on("disconnect", () => {
      console.log("WS disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return { usersMap };
}
