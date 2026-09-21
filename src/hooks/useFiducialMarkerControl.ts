import { useCallback } from "react";

import { ChamberFiducialClient, FiducialMarker } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useFiducialMarkersStore from "../stores/fiducialMarkers";

/** No standalone export for the tagged union; derive it from the field that carries it. */
type Shape = FiducialMarker["shape"];

/**
 * Sets and removes fiducial markers on `chamber.fiducial`.
 *
 * Unlike the RHEED boxes (`useAnalyzerControl`), a marker has no separate
 * "registered" step -- drawing it *is* registering it, since the shape is the
 * whole of what the capability tracks. So this writes straight through:
 * `set_marker`/`remove_marker`, then an optimistic local update so the overlay
 * reacts before the next heartbeat, rather than waiting up to 2s for
 * `useFiducialMarkersSync` to notice the id list moved. A failed call leaves
 * the store untouched, so a rejected write does not draw a marker the node
 * never accepted.
 */
const useFiducialMarkerControl = () => {
  const transport = useTransportStore((s) => s.transport);

  const setMarker = useCallback(
    async (markerId: string, shape: Shape) => {
      if (!transport) return;
      const marker: FiducialMarker = { marker_id: markerId, shape };
      await new ChamberFiducialClient(transport).set_marker(marker);
      useFiducialMarkersStore.setState((s) => ({
        geometry: { ...s.geometry, [markerId]: marker },
      }));
    },
    [transport]
  );

  const removeMarker = useCallback(
    async (markerId: string) => {
      if (!transport) return;
      await new ChamberFiducialClient(transport).remove_marker({ marker_id: markerId });
      useFiducialMarkersStore.setState((s) => {
        const geometry = { ...s.geometry };
        delete geometry[markerId];
        return { geometry };
      });
    },
    [transport]
  );

  return { setMarker, removeMarker };
};

export default useFiducialMarkerControl;
