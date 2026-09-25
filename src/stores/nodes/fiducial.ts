// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

export interface FiducialNodeState extends StreamNodeState {
  /**
   * The marker ids the *backend* holds, in no particular order -- not the
   * markers this browser has drawn.
   *
   * Like `IntegratorNodeState.registered_bboxes`, this is the frontend's live
   * view of a registry that lives on the node and is shared by every client,
   * riding the node's 2s heartbeat. See `useFiducialMarkers`, which turns these
   * ids into drawable shapes.
   */
  marker_ids: string[];
  /**
   * Role -> marker_id, the same map `list_roles()` returns, riding the same
   * heartbeat -- so a re-tag by any client shows up within one beat. Null
   * until a heartbeat carrying it lands. See `useFiducialRolesSync`.
   */
  roles: Record<string, string> | null;
  /**
   * Size of the frames markers are measured against, as last seen from the
   * camera. Null until the fiducial worker has processed a frame -- a marker
   * drawn before that has nothing to scale against yet.
   */
  frame_width: number | null;
  frame_height: number | null;
  /** Frames the stats worker has measured. Advancing means it is alive. */
  n_processed: number | null;
}

interface FiducialNode extends StreamNode<FiducialNodeState> {}

const useFiducialNodeStore = create<FiducialNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      marker_ids: [],
      roles: null,
      frame_width: null,
      frame_height: null,
      n_processed: null,
    },
    setState: (newState) => set((state) => {
      Object.assign(state.state, newState);
    }),

    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useFiducialNodeStore;
