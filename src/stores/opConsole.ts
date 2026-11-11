import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OpConsoleState {
  /** Op ids pinned in the experiment driver's operation console, top to bottom. */
  pinned: string[];
  setPinned: (ids: string[]) => void;
}

/**
 * Kept in this browser (localStorage): which ops an operator keeps on screen
 * is a per-station layout preference, like the dashboard's own, not driver
 * state another console should see.
 */
const useOpConsoleStore = create<OpConsoleState>()(
  persist(
    (set) => ({
      pinned: [],
      setPinned: (ids) => set({ pinned: ids }),
    }),
    { name: "lumi-op-console" }
  )
);

export default useOpConsoleStore;
