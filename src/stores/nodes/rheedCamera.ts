// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

export interface RHEEDCameraNodeState extends StreamNodeState {
}

interface RHEEDCameraNode extends StreamNode<RHEEDCameraNodeState> {}

const useRHEEDCameraNodeStore = create<RHEEDCameraNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
    },
    setState: (newState) => set((state) => {
        Object.assign(state.state, newState);
    }),

    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useRHEEDCameraNodeStore;
