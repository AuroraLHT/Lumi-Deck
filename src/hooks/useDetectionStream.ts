import { useEffect, useRef } from "react";

import { DetectionDetectionClient, DetectionOverlayClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useDetectionStore from "../stores/detection";
import useDetectorNodeStore from "../stores/nodes/detector";

/**
 * Feeds the detection store from the `detection.overlay` capability over the
 * shared LumiTransport, replacing the detections that used to ride the removed
 * `ws://host/RHEED/analysis/live` socket.
 *
 * `detection.overlay` rather than `detection.detection` on purpose: the overlay
 * is the same boxes minus the masks and the pattern, which is all the browser
 * draws. The heavy arrays stay on the bus instead of being shipped to every
 * open tab.
 *
 * Mounted exactly once, by `LumiTransportProvider` -- `LumiTransport.subscribe`
 * keys handlers by `target:stream`, so a second subscriber would silently
 * replace the first.
 *
 * Nothing is sent unless the registry reports a detection node up, and that
 * guard is load-bearing rather than merely tidy. The bridge serves a connection's
 * requests **serially**: a call to a capability with no node behind it occupies
 * the socket for its full server-side timeout (~10s) and every request queued
 * behind it fails. Firing `getState()` at an absent detection node on mount was
 * enough to make the RHEED video's `initial_fragments` time out and the video
 * panel come up empty. `is_available` here is fed by `useNodeStates`, so this
 * costs no extra subscription.
 */
const useDetectionStream = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const detectionNodeUp = useDetectorNodeStore((s) => s.state.is_available);
  const trackedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport || !detectionNodeUp) return;

    if (trackedHost.current !== null && trackedHost.current !== host) {
      useDetectionStore.getState().reset();
    }
    trackedHost.current = host;

    let cancelled = false;
    const overlay = new DetectionOverlayClient(transport);
    const detection = new DetectionDetectionClient(transport);

    const subscriptionKey = overlay.onOverlay((sample) => {
      if (cancelled) return;
      useDetectionStore.getState().applyOverlay(sample);
    });

    // The crop is not on the overlay frames -- read it from the detector's state
    // so the rectangles can map box coordinates back onto the full frame.
    detection
      .getState()
      .then((state) => {
        if (cancelled) return;
        const crop = state.crop;
        useDetectionStore.getState().setCropSetup(
          crop
            ? {
                sx: crop.x,
                sy: crop.y,
                ex: crop.x + crop.width,
                ey: crop.y + crop.height,
              }
            : null
        );
      })
      .catch((err) => {
        // Expected when no detection node is up; the overlay simply stays empty.
        if (!cancelled) console.warn("Detection getState unavailable:", err);
      });

    // Never stop on unmount -- the stream is server-wide and shared.
    overlay.startStreaming().catch((err) => {
      if (!cancelled) console.warn("Detection overlay startStreaming failed:", err);
    });

    return () => {
      cancelled = true;
      overlay.unsubscribe(subscriptionKey);
    };
  }, [transport, host, detectionNodeUp]);
};

export default useDetectionStream;
