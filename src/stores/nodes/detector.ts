// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

export interface DetectorNodeState extends StreamNodeState {
  pattern_dim: number[];
  detection_metas: string[];
  classifier_classes: string[];
}

interface DetectorNode extends StreamNode<DetectorNodeState> {
}

const useDetectorNodeStore = create<DetectorNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      pattern_dim: [],
      detection_metas: [],
      classifier_classes: [],
    },
    setState: (newState) => set((state) => {
      Object.assign(state.state, newState);
    }),
    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    }),
  }))
);

export default useDetectorNodeStore;
