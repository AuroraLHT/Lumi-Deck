// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

export interface IntegratorNodeState extends StreamNodeState {
  /**
   * The bbox ids the *backend* is integrating, ascending -- not the boxes this
   * browser drew.
   *
   * This is the frontend's live view of a registry that lives on the node and
   * is shared by every client. It rides the node's 2s heartbeat, so a box
   * registered by another session (or one that outlived this page's last
   * reload) shows up here within about two seconds without anything polling.
   * See `useRegisteredBoxes`, which turns these ids into drawable boxes.
   */
  registered_bboxes: number[];
}

interface IntegratorNode extends StreamNode<IntegratorNodeState> {}

const useIntegratorNodeStore = create<IntegratorNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      registered_bboxes: [],
    },
    setState: (newState) => set((state) => {
        // console.log("IntegratorNodeState", newState);
        Object.assign(state.state, newState);
    }),

    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useIntegratorNodeStore;
