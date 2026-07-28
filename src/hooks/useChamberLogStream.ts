import { useEffect, useRef } from "react";

import { ChamberLogClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useChamberLogStore from "../stores/chamberLog";

/**
 * Feeds the chamber log cache from the backend's `chamber.log` capability over
 * the shared LumiTransport, replacing the old dedicated `ws://host/chamber/live`
 * socket (that endpoint no longer exists -- the bridge speaks one protocol
 * on `/ws`).
 *
 * Mounted exactly once, by `LumiTransportProvider`. It must not be called from
 * the chart components: `LumiTransport.subscribe` keys handlers by
 * `target:stream` in a map, so a second subscriber would silently replace the
 * first and only one chart would ever update. Subscribing at the provider also
 * means the cache keeps filling while the Monitor panel is closed, so opening it
 * shows history instead of an empty chart.
 *
 * Re-subscribes automatically when the transport reconnects, because a fresh
 * `LumiTransport` instance re-runs the effect.
 */
const useChamberLogStream = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const chartedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport) return;

    // Rows from a different chamber must not be charted as a continuation of
    // the previous host's history. A plain reconnect keeps the cache.
    if (chartedHost.current !== null && chartedHost.current !== host) {
      useChamberLogStore.getState().reset();
    }
    chartedHost.current = host;

    let cancelled = false;
    const client = new ChamberLogClient(transport);

    // Subscribe before start so the first rows the node emits are not missed.
    const subscriptionKey = client.onLog((entry) => {
      if (cancelled) return;
      useChamberLogStore.getState().appendEntries([entry]);
    });

    // Seed with what the node already holds so a freshly opened chart is not
    // blank until the first tick. Only seed while the cache is still empty: if
    // a row streamed in while this request was in flight, appending the older
    // batch behind it would plot the series going backwards in time.
    client
      .log()
      .then((batch) => {
        if (cancelled) return;
        const store = useChamberLogStore.getState();
        if (store.logs.length === 0) store.appendEntries(batch.entries ?? []);
      })
      .catch((err) => {
        if (!cancelled) console.error("ChamberLog log() failed:", err);
      });

    // The capability's stream may already be running (another session, or the
    // Controller toggle); start is idempotent on the backend. Never stop on
    // unmount -- the stream is server-wide and shared with other viewers.
    client.startStreaming().catch((err) => {
      if (!cancelled) console.error("ChamberLog startStreaming failed:", err);
    });

    return () => {
      cancelled = true;
      client.unsubscribe(subscriptionKey);
    };
  }, [transport, host]);
};

export default useChamberLogStream;
