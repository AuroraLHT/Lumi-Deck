// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

export interface STFTNodeState extends StreamNodeState {
  /**
   * The bbox ids the backend is running an STFT over, ascending. Always a
   * subset of the integrator's: the STFT of a box is computed from that box's
   * integration series, so registering a box here registers it there first.
   *
   * Live from the heartbeat, same as the integrator's -- see
   * `IntegratorNodeState.registered_bboxes`.
   */
  registered_bboxes: number[];
}

interface STFTNode extends StreamNode<STFTNodeState> {}

const useSTFTNodeStore = create<STFTNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      registered_bboxes: [],
    },
    setState: (newState) => set((state) => {
        // console.log("STFTNodeState", newState);
        Object.assign(state.state, newState);
    }),

    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useSTFTNodeStore;
