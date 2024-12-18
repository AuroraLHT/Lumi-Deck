// store.ts
import { create } from "zustand";
import { StreamNode, StreamNodeState } from "./base";
import { immer } from "zustand/middleware/immer";

export interface RHEEDNodeState extends StreamNodeState {
  frame_dims: number[];
  frame_metas: string[];
  video_fps: number;
  video_height: number;
  video_width: number;
}

interface RHEEDNode extends StreamNode<RHEEDNodeState> {}

const useRHEEDNodeStore = create<RHEEDNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      frame_dims: [540, 720],
      frame_metas: [],
      video_fps: 60,
      video_height: 540,
      video_width: 720,
    },
    setState: (newState) => set((state) => {
        Object.assign(state.state, newState);
    }),

    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    })
  }))
);

export default useRHEEDNodeStore;