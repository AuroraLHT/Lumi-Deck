import { useCallback } from "react";

import { BBox, RheedIntegratorClient, RheedStftClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useIntegratorStore from "../stores/integrator";
import useSTFTStore from "../stores/stft";
import { SelectedDetection } from "../stores/liveAnalysis";

export type AnalyzerRequest = "register" | "remove";

/**
 * Registers and removes the boxes that `rheed.integrator` and `rheed.stft`
 * compute over, replacing the old `sendIntegratorRequest` / `sendSTFTRequest`
 * commands that rode the removed `/RHEED/analysis/live` socket.
 *
 * The frontend's detection id doubles as the backend's `bbox_id`: ids are
 * assigned as "0", "1", ... by `useLiveAnalysisStore`, and the nodes key their
 * results by that same number, so a box registered here lands in the caches
 * under the id the visualizers look up with `focusedDetectionID`.
 */

/**
 * Detections carry `[x1, y1, x2, y2]`; the capabilities want origin + extent.
 *
 * The rounding is required, not cosmetic: `BBox` is declared with integer pixel
 * fields, and a manually drawn box arrives as floats (`RectangleSelector` scales
 * by the frame dimensions), so passing them through makes the backend reject the
 * whole call with `int_from_float` and the box silently never registers.
 *
 * Corners are rounded rather than the extents, so the region keeps the edges the
 * user actually drew instead of drifting by a pixel. A degenerate box (a stray
 * click) is widened to 1px -- a zero-width region has no pixels to integrate.
 */
const toBBox = (bbox: number[]): BBox => {
  const x = Math.round(bbox[0]);
  const y = Math.round(bbox[1]);
  return {
    x,
    y,
    width: Math.max(1, Math.round(bbox[2]) - x),
    height: Math.max(1, Math.round(bbox[3]) - y),
  };
};

const useAnalyzerControl = () => {
  const transport = useTransportStore((s) => s.transport);

  const sendIntegratorRequest = useCallback(
    (request: AnalyzerRequest, detection: SelectedDetection) => {
      if (!transport) return;
      const client = new RheedIntegratorClient(transport);
      const bbox_id = Number(detection.id);

      if (request === "register") {
        client.register({ bbox_id, bbox: toBBox(detection.bbox) }).catch((err) =>
          console.error("Integrator register failed:", err)
        );
        return;
      }
      // Drop the series as well, so an unregistered box stops being charted
      // instead of freezing at its last value.
      client
        .remove({ bbox_id })
        .catch((err) => console.error("Integrator remove failed:", err));
      useIntegratorStore.getState().clearBox(detection.id);
    },
    [transport]
  );

  const sendSTFTRequest = useCallback(
    (request: AnalyzerRequest, detection: SelectedDetection) => {
      if (!transport) return;
      const client = new RheedStftClient(transport);
      const bbox_id = Number(detection.id);

      if (request === "register") {
        client.register({ bbox_id, bbox: toBBox(detection.bbox) }).catch((err) =>
          console.error("STFT register failed:", err)
        );
        return;
      }
      client
        .remove({ bbox_id })
        .catch((err) => console.error("STFT remove failed:", err));
      useSTFTStore.getState().clearBox(detection.id);
    },
    [transport]
  );

  return { sendIntegratorRequest, sendSTFTRequest };
};

export default useAnalyzerControl;
