import { create } from "zustand";

import { FiducialMarker } from "../generated/lumi";

/**
 * Where the *geometry* of the backend's fiducial markers lives.
 *
 * Mirrors `stores/registeredBoxes.ts`. The markers themselves are the node's,
 * not this browser's: `chamber.fiducial` keeps a registry of them, shared by
 * every client and outliving any one page. Which ids are in it arrives free on
 * the 2s heartbeat (`FiducialState.marker_ids`, projected onto
 * `stores/nodes/fiducial.ts`); their shapes do not, because the heartbeat
 * carries only the id list. So this store holds the one thing the heartbeat
 * cannot tell us, fetched from `list_markers()` whenever the id set moves.
 *
 * Read this through `useFiducialMarkers()`, which joins it back to the ids.
 */
interface FiducialMarkersState {
  /** Keyed by `marker_id`. */
  geometry: Record<string, FiducialMarker>;
  /** True only during the first fetch, so the UI can tell "none" from "not yet". */
  isLoading: boolean;
  error: string | null;
  /** `Date.now()` of the last successful fetch; null until one lands. */
  lastSyncedAt: number | null;

  setGeometry: (geometry: Record<string, FiducialMarker>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const useFiducialMarkersStore = create<FiducialMarkersState>((set) => ({
  geometry: {},
  isLoading: false,
  error: null,
  lastSyncedAt: null,

  setGeometry: (geometry) =>
    set({ geometry, isLoading: false, error: null, lastSyncedAt: Date.now() }),

  setLoading: (isLoading) => set({ isLoading }),

  // A failed refetch leaves the last good geometry in place rather than
  // blanking the overlay: the markers are still registered on the node, and one
  // dropped call is not a reason to make them disappear from the screen.
  setError: (error) => set({ error, isLoading: false }),

  reset: () =>
    set({ geometry: {}, isLoading: false, error: null, lastSyncedAt: null }),
}));

export default useFiducialMarkersStore;
