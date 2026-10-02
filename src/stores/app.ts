// store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedHost: string;
  setSelectedHost: (host: string) => void;

  /** Hosts the user has added on top of the built-in list. */
  customHosts: string[];
  addCustomHost: (host: string) => void;
  removeCustomHost: (host: string) => void;
}

export const DEFAULT_HOSTS = [
  "127.0.0.1:8000",
  "localhost:8000",
];

/**
 * The rest of the app builds request URLs from this host via `httpOrigin` /
 * `wsOrigin` below, so it must be a bare `host[:port]` -- no path, no trailing
 * slash -- optionally prefixed with `https://` when the backend terminates TLS
 * itself (the simulation stack and most lab servers still speak plain
 * http/ws, so bare stays the default). Accept the forms a user is likely to
 * paste and reduce them to that: `wss://` collapses to the same `https://`
 * marker, `http://`/`ws://` are dropped since they're the default.
 */
export const normalizeHost = (raw: string): string => {
  const trimmed = raw.trim().replace(/\s+/g, "").replace(/\/+$/, "");
  const secure = /^(https|wss):\/\//i.test(trimmed);
  const bare = trimmed.replace(/^[a-z]+:\/\//i, "");
  return secure ? `https://${bare}` : bare;
};

/** Whether `host` (as stored by `normalizeHost`) points at a TLS backend. */
export const isSecureHost = (host: string): boolean =>
  /^https:\/\//i.test(host);

/** `host` with any scheme marker stripped, e.g. for building a ws(s) URL. */
export const hostAddress = (host: string): string =>
  host.replace(/^https:\/\//i, "");

/** The REST base URL for `host`: `https://` as stored, `http://` otherwise. */
export const httpOrigin = (host: string): string =>
  isSecureHost(host) ? host : `http://${host}`;

/** The WebSocket origin for `host`: `wss://` when secure, `ws://` otherwise. */
export const wsOrigin = (host: string): string =>
  isSecureHost(host) ? `wss://${hostAddress(host)}` : `ws://${host}`;

/**
 * Persisted to localStorage rather than to the backend settings API: the user
 * must pick a host *before* they can log in, so this one setting cannot live on
 * the server.
 */
const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedHost: "",
      setSelectedHost: (host) => set({ selectedHost: host }),

      customHosts: [],
      addCustomHost: (host) => {
        const clean = normalizeHost(host);
        if (!clean || get().customHosts.includes(clean)) return;
        if (DEFAULT_HOSTS.includes(clean)) return;
        set((state) => ({ customHosts: [...state.customHosts, clean] }));
      },
      removeCustomHost: (host) =>
        set((state) => ({
          customHosts: state.customHosts.filter((h) => h !== host),
        })),
    }),
    { name: "lumi-app" }
  )
);

export default useAppStore;
