import { useEffect, useRef } from "react";

import { ExperimentDriverClient, ExperimentState, FinishedTask, LumiTransport } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useExperimentDriverStore, { DriverTaskResult } from "../stores/experimentDriver";
import useExperimentDriverNodeStore, {
  ExperimentDriverNodeState,
} from "../stores/nodes/experimentDriver";

/**
 * `ExperimentState` -> the node store's fields. Shared by the heartbeat
 * projection (`useNodeStates`) and the post-event refresh below, so the two
 * cannot drift apart.
 */
export const projectDriverState = (
  s: ExperimentState | undefined
): Omit<ExperimentDriverNodeState, "is_available"> => ({
  is_running: Boolean(s?.is_running),
  mode: s?.mode ?? null,
  project_name: s?.project_name ?? null,
  substrate_id: s?.substrate_id ?? null,
  current_pixel_index: s?.current_pixel_index ?? null,
  num_pixel_positions: s?.num_pixel_positions ?? null,
  is_recording: Boolean(s?.is_recording),
  pending_confirmation: s?.pending_confirmation ?? null,
  current_task: s?.current_task ?? null,
  deps_available: s?.deps_available ?? {},
  error: s?.error ?? null,
  center_mask_pos: s?.center_mask_pos ?? null,
  laser_power_set: s?.laser_power_set ?? null,
  laser_power_real: s?.laser_power_real ?? null,
  sequence: s?.sequence ?? null,
  rheed_search: s?.rheed_search ?? null,
  rheed_boxes: s?.rheed_boxes ?? {},
});

/** A task's result, from the event that ended it or from the driver's `last_task`. */
const toResult = (
  result: Record<string, unknown>,
  task: { kind: string; id: string } | null | undefined,
  finishedAt: number
): DriverTaskResult => {
  const ok = result.ok === true;
  return {
    kind: task?.kind ?? null,
    taskId: task?.id ?? null,
    finishedAt,
    ok,
    error: ok ? null : String(result.error ?? "task failed"),
    data: result,
  };
};

/**
 * The driver's last finished task, kept unless the stream already caught it:
 * after a reload (or an event missed while disconnected) it is the only way
 * back to that outcome. `finished_at` is the node's `time.time()`, in seconds.
 */
const seedLastTask = (last: FinishedTask | null | undefined) => {
  if (!last) return;
  useExperimentDriverStore.getState().seedResult(toResult(last.result, last.task, last.finished_at * 1000));
};

/**
 * Pull the driver's state now instead of waiting up to 2s for the heartbeat.
 * Called on connect and after every op the panel makes -- some ops
 * (`set_center_mask_pos`, `set_rheed_gain`) change state without an event.
 */
export const refreshDriverState = async (transport: LumiTransport) => {
  const state = await new ExperimentDriverClient(transport).getState();
  useExperimentDriverNodeStore.getState().setState(projectDriverState(state));
  seedLastTask(state.last_task);
};

/**
 * Listens on the experiment driver's `pending` channel. Mounted exactly once,
 * by `LumiTransportProvider`, for the reasons `useMiModeStream` gives: one
 * handler per `target:stream`, and a task's result is broadcast once and
 * never queryable, so it has to be caught while the panel is closed too.
 *
 * Each event is a full snapshot of the gate, the running task, the open
 * RHEED emission search and the agents' RHEED boxes (None means none, not "unchanged"), so it is applied
 * as-is. A finishing task's event
 * also carries its `task_result` and, in `finished_task`, which op it was --
 * the result is kept in `stores/experimentDriver.ts`.
 *
 * Guarded on `is_available` for the same reason as `useMiModeStream`: a
 * request at an absent node holds the connection for the whole server-side
 * timeout.
 */
const useExperimentDriverStream = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const driverUp = useExperimentDriverNodeStore((s) => s.state.is_available);
  const trackedHost = useRef<string | null>(null);

  useEffect(() => {
    if (!transport || !driverUp) return;

    // Another chamber's results are not this one's history.
    if (trackedHost.current !== null && trackedHost.current !== host) {
      useExperimentDriverStore.getState().reset();
    }
    trackedHost.current = host;

    let cancelled = false;
    const client = new ExperimentDriverClient(transport);

    const key = client.onPending((event) => {
      if (cancelled) return;
      useExperimentDriverNodeStore.getState().setState({
        pending_confirmation: event.pending_confirmation ?? null,
        current_task: event.current_task ?? null,
        rheed_search: event.rheed_search ?? null,
        rheed_boxes: event.rheed_boxes ?? {},
      });
      const result = event.task_result;
      if (result) {
        useExperimentDriverStore.getState().addResult(toResult(result, event.finished_task, Date.now()));
      }
    });

    // Seed after subscribing, so a push landing mid-request is not missed.
    refreshDriverState(transport).catch((err) => {
      if (!cancelled) console.warn("experiment.driver getState failed:", err);
    });

    return () => {
      cancelled = true;
      client.unsubscribe(key);
    };
  }, [transport, host, driverUp]);
};

export default useExperimentDriverStream;
