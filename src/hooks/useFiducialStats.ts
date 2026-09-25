import { useEffect, useRef } from "react";

import { ChamberFiducialClient, MarkerStatsSample } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useFiducialNodeStore from "../stores/nodes/fiducial";
import useFiducialStatsStore from "../stores/fiducialStats";

// Same coalescing as `useAnalysisStreams` -- the worker measures every camera
// frame, and committing each sample separately would re-render the overlay's
// live readout and the trace chart in lockstep with it.
const FLUSH_MS = 100;

/**
 * Feeds the fiducial stats cache from `chamber.fiducial`'s `stats` stream over
 * the shared LumiTransport. Mirrors `useAnalysisStreams`.
 *
 * Mounted exactly once, by `LumiTransportProvider` -- `LumiTransport.subscribe`
 * keys handlers by `target:stream`, so a second subscriber would silently
 * replace the first. Gated on the chamber node being up for the same reason
 * `useDetectionStream` gates on the detection node: the bridge serves a
 * connection's requests serially, and firing `startStreaming` at an absent node
 * would occupy the socket for its full server-side timeout and stall every
 * request queued behind it.
 */
const useFiducialStats = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const chamberUp = useFiducialNodeStore((s) => s.state.is_available);
  const cachedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport || !chamberUp) return;

    if (cachedHost.current !== null && cachedHost.current !== host) {
      useFiducialStatsStore.getState().reset();
    }
    cachedHost.current = host;

    let cancelled = false;
    const client = new ChamberFiducialClient(transport);

    let pending: MarkerStatsSample[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      if (cancelled || pending.length === 0) return;
      useFiducialStatsStore.getState().appendSamples(pending);
      pending = [];
    };

    const scheduleFlush = () => {
      if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
    };

    const subscriptionKey = client.onStats((sample) => {
      if (cancelled) return;
      pending.push(sample);
      scheduleFlush();
    });

    // May already be running (another session, or the Controller toggle);
    // start is idempotent. Never stopped on unmount -- server-wide, shared.
    client.startStreaming().catch((err) => {
      if (!cancelled) console.error("Fiducial startStreaming failed:", err);
    });

    return () => {
      cancelled = true;
      if (flushTimer !== null) clearTimeout(flushTimer);
      pending = [];
      client.unsubscribe(subscriptionKey);
    };
  }, [transport, host, chamberUp]);
};

export default useFiducialStats;
