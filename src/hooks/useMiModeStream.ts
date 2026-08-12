import { useEffect, useRef } from "react";

import { ChamberMiModeClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useMiModeStore from "../stores/miMode";
import useMIModeNodeStore from "../stores/nodes/miMode";

/**
 * Feeds the MI-mode execution history from the chamber's `mi_mode` capability.
 *
 * Mounted exactly once, by `LumiTransportProvider`, for two reasons:
 *
 * 1. `LumiTransport.subscribe` keys handlers by `target:stream`, so a second
 *    subscriber would silently replace the first.
 * 2. Terminal states are only ever *broadcast*, never queryable. The node erases
 *    an execution as it finishes, so if nothing is listening when a script
 *    completes, that completion is lost for good -- see `stores/miMode.ts`.
 *    Subscribing here means the history keeps filling while the panel is closed.
 *
 * There is no `startStreaming` to call: mi_mode is PUBSUB, and the backend runs
 * its update loop from server start rather than gating it behind a subscriber
 * ("updates are results being broadcast, not a feed someone subscribes to" --
 * `base/mq/server.py:166`).
 *
 * The `is_available` guard is load-bearing, not tidiness. The bridge serves a
 * connection's requests serially, so calling `list_execution()` at an absent
 * chamber occupies the socket for the full server-side timeout (~10s) and every
 * request queued behind it fails. `is_available` comes from `useNodeStates`, so
 * this costs no extra subscription.
 */
const useMiModeStream = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const miModeNodeUp = useMIModeNodeStore((s) => s.state.is_available);
  const trackedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport || !miModeNodeUp) return;

    // Another chamber's scripts are not a continuation of this one's history.
    // A plain reconnect keeps the cache.
    if (trackedHost.current !== null && trackedHost.current !== host) {
      useMiModeStore.getState().reset();
    }
    trackedHost.current = host;

    let cancelled = false;
    const client = new ChamberMiModeClient(transport);

    // Subscribe before seeding so a transition landing mid-request is not missed.
    const subscriptionKey = client.onExecution((execution) => {
      if (cancelled) return;
      useMiModeStore.getState().applyExecution(execution);
    });

    // Seed with whatever the node is still holding -- queued and running only,
    // since it drops an execution the moment it finishes.
    client
      .list_execution()
      .then((list) => {
        if (cancelled) return;
        useMiModeStore.getState().seedExecutions(list.executions ?? []);
      })
      .catch((err) => {
        if (!cancelled) console.warn("MI mode list_execution failed:", err);
      });

    return () => {
      cancelled = true;
      client.unsubscribe(subscriptionKey);
    };
  }, [transport, host, miModeNodeUp]);
};

export default useMiModeStream;
