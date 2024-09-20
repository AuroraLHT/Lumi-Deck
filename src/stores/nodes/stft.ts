// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

interface STFTNodeState extends StreamNodeState {
}

interface STFTNode extends StreamNode<STFTNodeState> {}

const useSTFTNodeStore = create<STFTNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
    },
    setState: (newState) => set((state) => {
        console.log("STFTNodeState", newState);
        Object.assign(state.state, newState);
    }),

    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useSTFTNodeStore;
