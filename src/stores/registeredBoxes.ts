import { create } from "zustand";

import { BBox } from "../generated/lumi";

/**
 * Where the *geometry* of the backend's registered boxes lives.
 *
 * The boxes themselves are the node's, not this browser's: `rheed.integrator`
 * keeps a registry of them, shared by every client and outliving any one page.
 * Which ids are in it arrives free on the 2s heartbeat (see
 * `IntegratorNodeState.registered_bboxes`); their coordinates do not, because
 * the heartbeat carries only the id list. So this store holds the one thing the
 * heartbeat cannot tell us, fetched from `bboxes()` whenever the id set moves.
 *
 * Splitting it this way is what keeps the feature poll-free. The cheap, noisy
 * signal (ids, every 2s, pushed) decides *when* to pay for the expensive, quiet
 * one (geometry, one round trip, only on change). Polling `bboxes()` on a timer
 * would work too, and would be either laggy or wasteful depending on the
 * interval chosen.
 *
 * Read this through `useRegisteredBoxes()`, which joins it back to the ids.
 */
interface RegisteredBoxesState {
  /** Keyed by `String(bbox_id)`, matching the frontend's detection ids. */
  geometry: Record<string, BBox>;
  /** True only during the first fetch, so the UI can tell "none" from "not yet". */
  isLoading: boolean;
  error: string | null;
  /** `Date.now()` of the last successful fetch; null until one lands. */
  lastSyncedAt: number | null;

  setGeometry: (geometry: Record<string, BBox>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const useRegisteredBoxesStore = create<RegisteredBoxesState>((set) => ({
  geometry: {},
  isLoading: false,
  error: null,
  lastSyncedAt: null,

  setGeometry: (geometry) =>
    set({ geometry, isLoading: false, error: null, lastSyncedAt: Date.now() }),

  setLoading: (isLoading) => set({ isLoading }),

  // A failed refetch leaves the last good geometry in place rather than blanking
  // the list: the boxes are still registered on the node, and one dropped call
  // is not a reason to make them disappear from the screen.
  setError: (error) => set({ error, isLoading: false }),

  reset: () =>
    set({ geometry: {}, isLoading: false, error: null, lastSyncedAt: null }),
}));

export default useRegisteredBoxesStore;
