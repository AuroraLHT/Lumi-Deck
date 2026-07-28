import { useEffect, useRef } from "react";

import {
  IntegrationSample,
  RheedIntegratorClient,
  RheedStftClient,
  STFTSample,
} from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useIntegratorStore from "../stores/integrator";
import useSTFTStore from "../stores/stft";

// The integrator emits ~26 samples/second. Committing each one to the store
// separately meant ~26 store notifications -- and so ~26 chart re-renders -- per
// second, all of it synchronous inside the websocket message handler (the
// "'message' handler took 164ms" violations). Samples are collected and flushed
// on this interval instead; the charts cannot show more than this anyway.
const FLUSH_MS = 100;

/**
 * Feeds the integrator and STFT caches from the `rheed.integrator` and
 * `rheed.stft` capabilities over the shared LumiTransport, replacing the old
 * dedicated `ws://host/RHEED/analysis/live` socket (that endpoint no longer
 * exists -- the bridge speaks one protocol on `/ws`).
 *
 * Mounted exactly once, by `LumiTransportProvider`, for the same reason as
 * `useChamberLogStream`: `LumiTransport.subscribe` keys handlers by
 * `target:stream`, so a second subscriber would silently replace the first.
 * Subscribing here is cheap even with the Analyzer panel closed -- neither
 * capability emits anything until a box is registered (`useAnalyzerControl`).
 *
 * Re-subscribes automatically when the transport reconnects, because a fresh
 * `LumiTransport` instance re-runs the effect.
 */
const useAnalysisStreams = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const chartedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport) return;

    // Series from a different chamber must not continue the previous host's.
    // Registrations do not survive the switch either, so both caches go.
    if (chartedHost.current !== null && chartedHost.current !== host) {
      useIntegratorStore.getState().reset();
      useSTFTStore.getState().reset();
    }
    chartedHost.current = host;

    let cancelled = false;
    const integrator = new RheedIntegratorClient(transport);
    const stft = new RheedStftClient(transport);

    // Coalesce arrivals; see FLUSH_MS.
    let pendingIntegration: IntegrationSample[] = [];
    let pendingStft: STFTSample[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      if (cancelled) return;
      if (pendingIntegration.length > 0) {
        useIntegratorStore.getState().appendSamples(pendingIntegration);
        pendingIntegration = [];
      }
      if (pendingStft.length > 0) {
        useSTFTStore.getState().appendSamples(pendingStft);
        pendingStft = [];
      }
    };

    const scheduleFlush = () => {
      if (flushTimer === null) flushTimer = setTimeout(flush, FLUSH_MS);
    };

    const integratorKey = integrator.onIntegration((sample) => {
      if (cancelled) return;
      pendingIntegration.push(sample);
      scheduleFlush();
    });

    const stftKey = stft.onStft((sample) => {
      if (cancelled) return;
      pendingStft.push(sample);
      scheduleFlush();
    });

    // Both streams may already be running (another session, or the Controller
    // toggle); start is idempotent on the backend. Never stop on unmount -- the
    // streams are server-wide and shared with other viewers.
    integrator.startStreaming().catch((err) => {
      if (!cancelled) console.error("Integrator startStreaming failed:", err);
    });
    stft.startStreaming().catch((err) => {
      if (!cancelled) console.error("STFT startStreaming failed:", err);
    });

    return () => {
      cancelled = true;
      if (flushTimer !== null) clearTimeout(flushTimer);
      pendingIntegration = [];
      pendingStft = [];
      integrator.unsubscribe(integratorKey);
      stft.unsubscribe(stftKey);
    };
  }, [transport, host]);
};

export default useAnalysisStreams;
