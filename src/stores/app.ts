// store.ts
import { create } from 'zustand';

interface AppState {
  selectedHost: string;
  setSelectedHost: (host: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedHost: "",
  setSelectedHost: (host) => set({ selectedHost: host }),
}));
