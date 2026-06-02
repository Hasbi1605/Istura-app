// Singleton Echo instance untuk subscription realtime.
// Dimuat lazy saat halaman butuh channel public/admin.

import Echo from "laravel-echo";
import Pusher from "pusher-js";

declare global {
  interface Window {
    Pusher: typeof Pusher;
  }
}

let echoInstance: Echo<"reverb"> | null = null;

export type RealtimeConnectionStatus =
  | "disabled"
  | "idle"
  | "connecting"
  | "connected"
  | "unavailable"
  | "failed"
  | "disconnected";

type RealtimeStatusListener = (status: RealtimeConnectionStatus) => void;
type PusherConnection = {
  state?: string;
  bind(event: string, callback: (payload?: { current?: string }) => void): void;
  unbind(event: string, callback: (payload?: { current?: string }) => void): void;
};
type EchoWithPusherConnection = Echo<"reverb"> & {
  connector?: {
    pusher?: {
      connection?: PusherConnection;
    };
  };
};

const realtimeStatusListeners = new Set<RealtimeStatusListener>();
let realtimeStatus: RealtimeConnectionStatus = import.meta.env.VITE_REVERB_ENABLED === "true" ? "idle" : "disabled";
let unbindConnectionStatus: (() => void) | undefined;

function setRealtimeStatus(status: RealtimeConnectionStatus): void {
  if (realtimeStatus === status) return;
  realtimeStatus = status;
  realtimeStatusListeners.forEach((listener) => listener(status));
}

function pusherStateToRealtimeStatus(state?: string): RealtimeConnectionStatus {
  switch (state) {
    case "connected":
      return "connected";
    case "connecting":
    case "initialized":
      return "connecting";
    case "unavailable":
      return "unavailable";
    case "failed":
      return "failed";
    case "disconnected":
      return "disconnected";
    default:
      return "connecting";
  }
}

function bindConnectionStatus(echo: Echo<"reverb">): void {
  const connection = (echo as EchoWithPusherConnection).connector?.pusher?.connection;
  if (!connection) return;

  unbindConnectionStatus?.();

  const handlers: Array<[string, (payload?: { current?: string }) => void]> = [
    ["state_change", (payload) => setRealtimeStatus(pusherStateToRealtimeStatus(payload?.current ?? connection.state))],
    ["connected", () => setRealtimeStatus("connected")],
    ["connecting", () => setRealtimeStatus("connecting")],
    ["unavailable", () => setRealtimeStatus("unavailable")],
    ["failed", () => setRealtimeStatus("failed")],
    ["disconnected", () => setRealtimeStatus("disconnected")],
    ["error", () => setRealtimeStatus("unavailable")],
  ];

  handlers.forEach(([event, handler]) => connection.bind(event, handler));
  unbindConnectionStatus = () => {
    handlers.forEach(([event, handler]) => connection.unbind(event, handler));
  };
  setRealtimeStatus(pusherStateToRealtimeStatus(connection.state));
}

export function getRealtimeStatus(): RealtimeConnectionStatus {
  if (import.meta.env.VITE_REVERB_ENABLED !== "true") return "disabled";
  return realtimeStatus;
}

export function subscribeRealtimeStatus(listener: RealtimeStatusListener): () => void {
  listener(getRealtimeStatus());
  realtimeStatusListeners.add(listener);
  return () => {
    realtimeStatusListeners.delete(listener);
  };
}

export function getEcho(): Echo<"reverb"> | null {
  if (typeof window === "undefined") return null;
  if (import.meta.env.VITE_REVERB_ENABLED !== "true") {
    setRealtimeStatus("disabled");
    return null;
  }
  if (echoInstance) return echoInstance;

  window.Pusher = Pusher;
  setRealtimeStatus("connecting");

  echoInstance = new Echo({
    broadcaster: "reverb",
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 80),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? "http") === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: "/broadcasting/auth",
  });
  bindConnectionStatus(echoInstance);

  return echoInstance;
}

export function destroyEcho(): void {
  if (echoInstance) {
    unbindConnectionStatus?.();
    unbindConnectionStatus = undefined;
    echoInstance.disconnect();
    echoInstance = null;
    setRealtimeStatus(import.meta.env.VITE_REVERB_ENABLED === "true" ? "disconnected" : "disabled");
  }
}

export const ADMIN_BOOKINGS_CHANNEL = "admin.bookings";
export const PUBLIC_SCHEDULE_CHANNEL = "public.schedule";
