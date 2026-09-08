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
 * The rest of the app interpolates the host straight into `http://${host}` and
 * `ws://${host}/ws`, so it must be a bare `host[:port]` -- no scheme, no path,
 * no trailing slash. Accept the forms a user is likely to paste and reduce them
 * to that.
 */
export const normalizeHost = (raw: string): string =>
  raw
    .trim()
    .replace(/^[a-z]+:\/\//i, "") // strip http:// https:// ws:// wss://
    .replace(/\/+$/, "") // strip trailing slashes
    .replace(/\s+/g, "");

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
