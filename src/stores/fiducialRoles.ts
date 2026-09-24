import { create } from "zustand";

import { RoleSpec } from "../generated/lumi";

/**
 * Role -> marker_id assignments held by `chamber.fiducial`.
 *
 * A role is a free-form name ("sample_holder", "mask_alignment_target") pinned
 * to one marker, so an automated step -- or another operator -- can ask for
 * *the* sample-holder marker instead of a hardcoded id. Like the markers
 * themselves these live on the node, shared by every client and surviving a
 * restart, so this store is a mirror and never the source of truth.
 *
 * Unlike `marker_ids`, roles do not ride the heartbeat: nothing on the wire
 * announces a change, so the mirror is refreshed by `useFiducialRolesSync` and
 * written through by `useFiducialRoleControl`. A role may point at a marker
 * that does not exist -- the node deliberately does not clear it when a marker
 * is removed -- so read this through `useFiducialRoles()`, which flags those.
 */
interface FiducialRolesState {
  /** Keyed by role name; the value is a `marker_id`, existing or not. */
  roles: Record<string, string>;
  /**
   * The predefined roles -- the ones something in the backend actually reads
   * (e.g. `mask-center` for mask auto-alignment) -- assigned or not. Comes
   * from the node on every `list_roles()`, so the UI offers whatever the
   * backend currently knows about instead of a hardcoded list.
   */
  known: RoleSpec[];
  /** True only during the first fetch, so the UI can tell "none" from "not yet". */
  isLoading: boolean;
  error: string | null;
  /** `Date.now()` of the last successful fetch; null until one lands. */
  lastSyncedAt: number | null;

  setRoles: (roles: Record<string, string>, known: RoleSpec[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const useFiducialRolesStore = create<FiducialRolesState>((set) => ({
  roles: {},
  known: [],
  isLoading: false,
  error: null,
  lastSyncedAt: null,

  setRoles: (roles, known) =>
    set({ roles, known, isLoading: false, error: null, lastSyncedAt: Date.now() }),

  setLoading: (isLoading) => set({ isLoading }),

  // Same reasoning as `stores/fiducialMarkers.ts`: a failed refetch keeps the
  // last good mapping rather than blanking it, since the node still holds it.
  setError: (error) => set({ error, isLoading: false }),

  reset: () => set({ roles: {}, known: [], isLoading: false, error: null, lastSyncedAt: null }),
}));

export default useFiducialRolesStore;
