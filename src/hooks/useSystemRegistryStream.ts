import { useEffect } from "react";

import { NodeRecord, RegistryEvent, SystemRegistryClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useSystemRegistryStore from "../stores/systemRegistry";

// The backend keeps a dead node visible for a ~60s grave period, but the event
// stream has no explicit "removed" event, so a periodic list_nodes() reconciles
// nodes that have finally aged out. Events give the instant up/down updates in
// between.
const RECONCILE_MS = 30000;

/**
 * Owns the single `system.registry` subscription and fills the registry store.
 * Seeds from list_nodes(), then keeps the set current from onRegistryEvent()
 * pushes (join, leave, status change), reconciling removals on an interval.
 *
 * Mounted exactly once, by `LumiTransportProvider`. Consumers read the store via
 * `useSystemRegistry()` -- see `stores/systemRegistry.ts` for why this cannot be
 * per-caller state. Re-subscribes automatically when the transport reconnects,
 * because a fresh `LumiTransport` instance re-runs the effect.
 */
const useSystemRegistryStream = () => {
  const transport = useTransportStore((s) => s.transport);

  useEffect(() => {
    if (!transport) {
      useSystemRegistryStore.getState().reset();
      return;
    }

    let cancelled = false;
    const registry = new SystemRegistryClient(transport);

    const refresh = () =>
      registry
        .list_nodes()
        .then((list) => {
          if (cancelled) return;
          const next: Record<string, NodeRecord> = {};
          for (const node of list.nodes ?? []) next[node.instance_id] = node;
          useSystemRegistryStore.getState().setNodes(next);
        })
        .catch((err) => {
          if (cancelled) return;
          useSystemRegistryStore
            .getState()
            .setError(err instanceof Error ? err : new Error(String(err)));
        });

    refresh();
    const interval = setInterval(refresh, RECONCILE_MS);

    const key = registry.onRegistryEvent((evt: RegistryEvent) => {
      if (cancelled) return;
      useSystemRegistryStore.getState().upsertNode(evt.node);
    });

    // Turn on the registry's live event feed. Subscribing alone is not enough:
    // the monitor only publishes join/leave/state_changed while its stream is
    // running, so without this the list (and every capability's is_streaming)
    // would refresh only on the reconcile poll -- making stream toggles look
    // dead for up to RECONCILE_MS. The stream flag is server-wide, so we turn it
    // on and leave it on (cheap control-plane feed) rather than stopping it on
    // unmount and cutting live updates for other sessions.
    registry.startStreaming().catch(() => {
      /* the reconcile poll still keeps the list fresh if this fails */
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      registry.unsubscribe(key);
    };
  }, [transport]);
};

export default useSystemRegistryStream;
