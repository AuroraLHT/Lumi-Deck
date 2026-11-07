import { useEffect, useRef } from "react";

import { ChamberPldClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useChamberPldStore from "../stores/chamberPld";

const EVENTS_POLL_MS = 5000;
const EVENTS_LIMIT = 200;

/**
 * Feeds the chamber.pld cache: the full `PldChamberState` pushed on its `state`
 * stream, plus `recent_events`, which has no push channel and is polled.
 *
 * Mounted exactly once, by `LumiTransportProvider`, for the same reason as
 * `useChamberLogStream`: `LumiTransport.subscribe` keys handlers by
 * `target:stream`, so a second subscriber would replace the first, and the
 * cache should keep filling while the panel is closed.
 */
const useChamberPldStream = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const trackedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport) return;

    if (trackedHost.current !== null && trackedHost.current !== host) {
      useChamberPldStore.getState().reset();
    }
    trackedHost.current = host;

    let cancelled = false;
    const client = new ChamberPldClient(transport);

    // Subscribe before seeding so a push landing mid-request is not missed.
    const subscriptionKey = client.onState((state) => {
      if (cancelled) return;
      useChamberPldStore.getState().setChamber(state);
    });

    client
      .chamber_state()
      .then((state) => {
        if (!cancelled) useChamberPldStore.getState().setChamber(state);
      })
      .catch((err) => {
        if (!cancelled) console.error("chamber.pld chamber_state failed:", err);
      });

    // The capability's stream may already be running (another session, or the
    // Controller toggle); start is idempotent on the backend. Never stop on
    // unmount -- the stream is server-wide and shared with other viewers.
    client.startStreaming().catch((err) => {
      if (!cancelled) console.error("chamber.pld startStreaming failed:", err);
    });

    const pollEvents = () => {
      client
        .recent_events({ limit: EVENTS_LIMIT })
        .then((batch) => {
          if (!cancelled) useChamberPldStore.getState().setEvents(batch.events ?? []);
        })
        .catch((err) => {
          if (!cancelled) console.error("chamber.pld recent_events failed:", err);
        });
    };
    pollEvents();
    const eventsInterval = window.setInterval(pollEvents, EVENTS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(eventsInterval);
      client.unsubscribe(subscriptionKey);
    };
  }, [transport, host]);
};

export default useChamberPldStream;
