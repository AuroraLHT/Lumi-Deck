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
  "10.229.54.118:8000",
  "10.229.54.16:8000",
];

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
        const trimmed = host.trim();
        if (!trimmed || get().customHosts.includes(trimmed)) return;
        if (DEFAULT_HOSTS.includes(trimmed)) return;
        set((state) => ({ customHosts: [...state.customHosts, trimmed] }));
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
