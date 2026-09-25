import { useEffect, useMemo } from "react";

import { ChamberFiducialClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useFiducialNodeStore from "../stores/nodes/fiducial";
import useFiducialRolesStore from "../stores/fiducialRoles";

/**
 * Keeps the backend's role -> marker assignments mirrored into the frontend.
 *
 * Mounted exactly once, by `LumiTransportProvider`, next to
 * `useFiducialMarkersSync`. The assignments ride the chamber node's 2s
 * heartbeat (`FiducialState.roles`), so a re-tag by any client lands within a
 * beat with no fetch. What the heartbeat does not carry is `known` -- the
 * predefined roles -- which only changes when the backend is redeployed, so
 * `list_roles()` is called once per connection for it (and for the initial
 * mapping, so the menu is not blank until the first beat).
 *
 * The heartbeat is keyed as a sorted JSON string, not the object: the object
 * is rebuilt every beat, and an object dep would rewrite the store forever.
 */
export const useFiducialRolesSync = () => {
  const transport = useTransportStore((s) => s.transport);
  const beatKey = useFiducialNodeStore((s) =>
    s.state.roles === null
      ? null
      : JSON.stringify(Object.entries(s.state.roles).sort(([a], [b]) => a.localeCompare(b)))
  );

  useEffect(() => {
    if (!transport) {
      useFiducialRolesStore.getState().reset();
      return;
    }

    let cancelled = false;
    useFiducialRolesStore.getState().setLoading(true);

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
  }, [transport]);

  useEffect(() => {
    if (!transport || beatKey === null) return;
    const store = useFiducialRolesStore.getState();
    store.setRoles(Object.fromEntries(JSON.parse(beatKey)), store.known);
  }, [transport, beatKey]);
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
