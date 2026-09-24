import { useEffect, useMemo } from "react";

import { ChamberFiducialClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useFiducialNodeStore from "../stores/nodes/fiducial";
import useFiducialRolesStore from "../stores/fiducialRoles";

/**
 * Keeps the backend's role -> marker assignments mirrored into the frontend.
 *
 * Mounted exactly once, by `LumiTransportProvider`, next to
 * `useFiducialMarkersSync`. Roles are the awkward case that hook does not have:
 * nothing about them rides the 2s heartbeat, so there is no free signal that
 * another client re-tagged something. Rather than poll a mapping that changes
 * once a week, this fetches on connect and again whenever the marker id list
 * moves -- drawing or removing a marker is what usually surrounds a re-tag --
 * and `useFiducialRoleControl` writes through for this client's own edits. A
 * role another operator set on an unchanged marker set therefore lands on the
 * next marker change or reconnect, which is the right trade for a mapping the
 * automation reads far more often than anyone writes it.
 */
export const useFiducialRolesSync = () => {
  const transport = useTransportStore((s) => s.transport);
  const markerKey = useFiducialNodeStore((s) => s.state.marker_ids.join(","));

  useEffect(() => {
    if (!transport) {
      useFiducialRolesStore.getState().reset();
      return;
    }

    let cancelled = false;
    const store = useFiducialRolesStore.getState();
    if (store.lastSyncedAt === null) store.setLoading(true);

    new ChamberFiducialClient(transport)
      .list_roles()
      .then((map) => {
        if (cancelled) return;
        useFiducialRolesStore.getState().setRoles(map.roles ?? {}, map.known ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        useFiducialRolesStore
          .getState()
          .setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [transport, markerKey]);
};

/**
 * The role assignments, in the three shapes the UI actually reads them in.
 *
 * `dangling` is the one worth surfacing: the node keeps a role pointing at a
 * marker that has been removed (or was never drawn), on the grounds that the
 * operator meant something by it and losing the name silently is worse than
 * keeping a broken one. It is only broken from the UI's side, so the UI is
 * where it has to be flagged -- it almost always means "someone needs to
 * re-tag this".
 */
export const useFiducialRoles = () => {
  const roles = useFiducialRolesStore((s) => s.roles);
  const known = useFiducialRolesStore((s) => s.known);
  const isLoading = useFiducialRolesStore((s) => s.isLoading);
  const error = useFiducialRolesStore((s) => s.error);
  const markerKey = useFiducialNodeStore((s) => s.state.marker_ids.join(","));

  return useMemo(() => {
    const existing = new Set(markerKey === "" ? [] : markerKey.split(","));
    const entries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));

    const byMarker: Record<string, string[]> = {};
    const dangling: string[] = [];
    for (const [role, markerId] of entries) {
      if (existing.has(markerId)) (byMarker[markerId] ??= []).push(role);
      else dangling.push(role);
    }

    // A predefined role with no working marker behind it -- never assigned, or
    // pointing at one that is gone -- is a piece of automation that cannot
    // run (mask auto-alignment stalls waiting for `mask-center`), so it is
    // counted separately from a broken custom role, which only costs a label.
    const unmet = known
      .map((spec) => spec.role)
      .filter((role) => !(role in roles) || !existing.has(roles[role]));

    return {
      /** `[role, marker_id]` pairs, role-name order. */
      entries,
      /** Role names pointing at each existing marker, keyed by `marker_id`. */
      byMarker,
      /** Roles whose marker is not in the node's current id list. */
      dangling,
      /** The node's predefined roles, in the order it lists them. */
      known,
      /** Predefined role names that are unassigned or dangling. */
      unmet,
      isLoading,
      error,
    };
  }, [roles, known, markerKey, isLoading, error]);
};

export default useFiducialRoles;
