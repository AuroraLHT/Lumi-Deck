// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

interface DetectorNodeState extends StreamNodeState {
  pattern_dim: number[];
  detection_metas: string[];
  classifier_classes: string[];
  frame_dims: number[];
  frame_metas: string[];
  video_fps: number;
  video_height: number;
  video_width: number;
}

interface DetectorNode extends StreamNode<DetectorNodeState> {}

const useDetectorNodeStore = create<DetectorNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      pattern_dim: [],
      detection_metas: [],
      classifier_classes: [],
      frame_dims: [],
      frame_metas: [],
      video_fps: 0,
      video_height: 0,
      video_width: 0,
    },
    setState: (newState) => set((state) => {
      Object.assign(state.state, newState);
    }),
    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useDetectorNodeStore;
