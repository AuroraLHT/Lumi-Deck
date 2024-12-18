import { create } from "zustand";
import { NodeState, Node } from "./base";
import { immer } from "zustand/middleware/immer";

export interface ChamberLogNodeState extends NodeState {
  is_streaming: boolean;
  entries: string[];
  file_path: string | null;
}

interface ChamberLogNode extends Node<ChamberLogNodeState> {
  setStreaming: (isStreaming: boolean) => void;
  setFilePath: (path: string) => void;
}


const useChamberLogNodeStore = create<ChamberLogNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      entries: [],
      file_path: null,
    },
    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    }),
    setFilePath: (path: string) => set((state) => {
      state.state.file_path = path;
    }),
    setState: (newState) => set((state) => {
      Object.assign(state.state, newState);
    }),
  }))
);

export default useChamberLogNodeStore;
