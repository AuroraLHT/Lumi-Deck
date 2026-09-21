import { useEffect, useMemo } from "react";

import { ChamberFiducialClient, FiducialMarker } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useFiducialNodeStore from "../stores/nodes/fiducial";
import useFiducialMarkersStore from "../stores/fiducialMarkers";

/**
 * Keeps the backend's marker registry mirrored into the frontend, live.
 *
 * Mirrors `useRegisteredBoxesSync`. Mounted exactly once, by
 * `LumiTransportProvider`. There is no marker-change event to subscribe to,
 * but there does not need to be: `marker_ids` rides the chamber node's 2s
 * heartbeat (see `stores/nodes/fiducial.ts`), and a `set_marker` or
 * `remove_marker` by *anyone* changes that list, which is what
 * `useSystemRegistryStream` already delivers. All this hook adds is one
 * `list_markers()` call to pick up shapes, made only when the id set moves.
 *
 * Keyed on the ids joined into a string, not the array: the heartbeat rebuilds
 * that array every 2s, so an array dep would refetch forever.
 */
export const useFiducialMarkersSync = () => {
  const transport = useTransportStore((s) => s.transport);
  const markerKey = useFiducialNodeStore((s) => s.state.marker_ids.join(","));

  useEffect(() => {
    if (!transport) {
      useFiducialMarkersStore.getState().reset();
      return;
    }

    let cancelled = false;
    const store = useFiducialMarkersStore.getState();
    if (store.lastSyncedAt === null) store.setLoading(true);

    // Runs on connect as well as on every id change: on a fresh connection the
    // heartbeat has not landed yet, and `list_markers()` is authoritative, so
    // waiting for it would leave the overlay blank for up to two seconds.
    new ChamberFiducialClient(transport)
      .list_markers()
      .then((list) => {
        if (cancelled) return;
        const geometry: Record<string, FiducialMarker> = {};
        for (const marker of list.markers ?? []) geometry[marker.marker_id] = marker;
        useFiducialMarkersStore.getState().setGeometry(geometry);
      })
      .catch((err) => {
        if (cancelled) return;
        useFiducialMarkersStore
          .getState()
          .setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [transport, markerKey]);
};

/**
 * The backend's fiducial markers, joined from the live id list and the fetched
 * geometry. Mirrors `useRegisteredBoxes`.
 *
 * The join runs over the *ids*, not the geometry: the ids are the fresher of
 * the two, so a marker another client removed stops being drawn on the next
 * heartbeat even though its shape is still in the geometry cache. A marker
 * whose shape has not arrived yet is left out rather than drawn with stale
 * data -- that window is one round trip, since the id change is itself what
 * triggers the fetch.
 */
export const useFiducialMarkers = () => {
  const markerKey = useFiducialNodeStore((s) => s.state.marker_ids.join(","));
  const geometry = useFiducialMarkersStore((s) => s.geometry);
  const isLoading = useFiducialMarkersStore((s) => s.isLoading);
  const error = useFiducialMarkersStore((s) => s.error);
  const lastSyncedAt = useFiducialMarkersStore((s) => s.lastSyncedAt);

  return useMemo(() => {
    const ids = markerKey === "" ? [] : markerKey.split(",");
    const markers: FiducialMarker[] = [];
    for (const id of ids) {
      const marker = geometry[id];
      if (marker) markers.push(marker);
    }
    markers.sort((a, b) => a.marker_id.localeCompare(b.marker_id));

    return {
      markers,
      isLoading,
      error,
      lastSyncedAt,
      /** Ids the node reports but whose shape has not landed yet. */
      isSyncing: markers.length !== ids.length,
    };
  }, [markerKey, geometry, isLoading, error, lastSyncedAt]);
};

export default useFiducialMarkers;
