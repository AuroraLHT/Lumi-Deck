import { create } from "zustand";

import { LumiTransport } from "../generated/lumi";
import { wsOrigin } from "../stores/app";
import useAuthStore, { withAuthToken } from "../stores/auth";

/**
 * Owns the single websocket to the refactored backend bridge (`WS /ws`). Every
 * typed capability client from `generated/lumi.ts` multiplexes over this one
 * transport, so it is constructed once here and shared.
 *
 * The generated `LumiTransport` deliberately does not implement reconnection or
 * surface the close code, so this store wraps it: it tells "not logged in"
 * (close code 4401) apart from a dropped connection, logs the user out on the
 * former, and reconnects with backoff on the latter. React consumers depend on
 * `transport` identity -- a fresh instance after a reconnect makes them
 * re-subscribe their streams.
 */
export type TransportStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "unauthorized";

// The bridge closes an unauthenticated handshake with this code (guide §4).
const WS_UNAUTHORIZED = 4401;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

interface TransportState {
  transport: LumiTransport | null;
  status: TransportStatus;
  host: string;
  /**
   * Attempts in a row that failed to open (or dropped) since the last open
   * socket. A browser reports a refused certificate as a bare 1006, the same as
   * an unreachable server, so this count is all the UI has to go on.
   */
  failures: number;

  connect: (host: string) => void;
  disconnect: () => void;
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
// Bumped on every connect()/disconnect(); a socket whose captured epoch no longer
// matches is stale (host switched, logged out) and must not drive state/reconnect.
let epoch = 0;

const useTransportStore = create<TransportState>((set, get) => {
  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = (host: string, myEpoch: number) => {
    if (myEpoch !== epoch) return;
    clearReconnect();
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** reconnectAttempts,
      RECONNECT_MAX_MS
    );
    reconnectAttempts += 1;
    set({ failures: reconnectAttempts });
    reconnectTimer = setTimeout(() => open(host, myEpoch), delay);
  };

  const open = (host: string, myEpoch: number) => {
    if (myEpoch !== epoch) return;
    set({ status: "connecting", host });

    // withAuthToken appends the current `?token=` -- the browser WebSocket API
    // cannot send an Authorization header.
    const t = new LumiTransport(withAuthToken(`${wsOrigin(host)}/ws`));
    const connected = t.connect();

    // LumiTransport creates its WebSocket synchronously inside connect() and keeps
    // it private, so reach the raw socket to observe the close code. Reading the
    // private field is deliberate; the generated client must not be edited.
    const ws = (t as unknown as { ws: WebSocket }).ws;
    // A socket that fails to open both rejects `connected` and fires "close";
    // count it once, or the backoff (and `failures`) doubles per attempt.
    let failed = false;
    const fail = () => {
      if (failed || myEpoch !== epoch) return;
      failed = true;
      set({ status: "closed", transport: null });
      scheduleReconnect(host, myEpoch);
    };
    ws.addEventListener("close", (event) => {
      if (myEpoch !== epoch) return; // stale socket
      if (event.code === WS_UNAUTHORIZED) {
        failed = true;
        set({ status: "unauthorized", transport: null });
        useAuthStore.getState().logout();
        return;
      }
      fail();
    });

    connected
      .then(() => {
        if (myEpoch !== epoch) {
          t.close();
          return;
        }
        reconnectAttempts = 0;
        set({ transport: t, status: "open", failures: 0 });
      })
      .catch(fail);
  };

  return {
    transport: null,
    status: "idle",
    host: "",
    failures: 0,

    connect: (host) => {
      clearReconnect();
      reconnectAttempts = 0;
      epoch += 1;
      get().transport?.close();
      set({ failures: 0 });
      open(host, epoch);
    },

    disconnect: () => {
      clearReconnect();
      epoch += 1; // invalidate any in-flight socket and its reconnect
      get().transport?.close();
      set({ transport: null, status: "idle", failures: 0 });
    },
  };
});

export default useTransportStore;
