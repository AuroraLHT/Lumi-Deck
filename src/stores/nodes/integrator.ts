// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

interface IntegratorNodeState extends StreamNodeState {
}

interface IntegratorNode extends StreamNode<IntegratorNodeState> {}

const useIntegratorNodeStore = create<IntegratorNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
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
