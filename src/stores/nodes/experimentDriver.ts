import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { CurrentTask, PendingConfirmation } from "../../generated/lumi";
import { Node, NodeState } from "./base";

/**
 * The experiment driver's state (`ExperimentState`), as the rest of the UI
 * needs it.
 *
 * Fed from two places: the registry heartbeat (`useNodeStates`, every 2s,
 * everything) and the driver's `pending` events (`useExperimentDriverStream`),
 * which carry a full snapshot of the gate and the running task the moment
 * either changes -- so a prompt opening or a task finishing shows at once
 * rather than on the next beat.
 */
export interface ExperimentDriverNodeState extends NodeState {
  mode: string | null;
  project_name: string | null;
  substrate_id: number | null;
  current_pixel_index: number | null;
  num_pixel_positions: number | null;
  is_recording: boolean;
  /** The operator decision the driver is waiting on, or null. */
  pending_confirmation: PendingConfirmation | null;
  /** The long-running op in flight (`to_temperature`, `auto_align_center_mask`, ...), or null. */
  current_task: CurrentTask | null;
  /** Which nodes the driver depends on are up (`chamber`, `rheed`, `storage`). */
  deps_available: Record<string, boolean>;
  error: string | null;
  /**
   * Mask1 position (mm) that centres the slit on the sample -- the mask
   * calibration. Saved by the backend, so it survives a node restart.
   */
  center_mask_pos: number | null;
}

// `Node`, not `StreamNode`: the driver's `pending` channel is PUBSUB, like
// mi_mode's -- there is no start/stop, so `is_streaming` would always be false.
type ExperimentDriverNode = Node<ExperimentDriverNodeState>;

const useExperimentDriverNodeStore = create<ExperimentDriverNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      mode: null,
      project_name: null,
      substrate_id: null,
      current_pixel_index: null,
      num_pixel_positions: null,
      is_recording: false,
      pending_confirmation: null,
      current_task: null,
      deps_available: {},
      error: null,
      center_mask_pos: null,
    },
    setState: (newState) =>
      set((state) => {
        Object.assign(state.state, newState);
      }),
  }))
);

export default useExperimentDriverNodeStore;
