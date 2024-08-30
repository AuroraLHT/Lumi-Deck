// store.ts
import { create } from "zustand";

interface NodeState {
  isAvailable?: boolean;
  isRunning?: boolean;
}

interface ServerState {
  RHEEDNode: NodeState;
  ChamberNode: NodeState;
  RHEEDAINode: NodeState;
  StorageNode: NodeState;

  setRHEEDNodeState: (nodeState: NodeState) => void;
  setChamberNodeState: (nodeState: NodeState) => void;
  setRHEEDAINodeState: (nodeState: NodeState) => void;
  setStorageNodeState: (nodeState: NodeState) => void;
}

const useServerStore = create<ServerState>((set) => ({
  RHEEDNode: { isAvailable: false, isRunning: false },
  ChamberNode: { isAvailable: false, isRunning: false },
  RHEEDAINode: { isAvailable: false, isRunning: false },
  StorageNode: { isAvailable: false, isRunning: false },

  setRHEEDNodeState: (nodeState) =>
    set((state) => ({ RHEEDNode: { ...state.RHEEDNode, ...nodeState } })),
  setChamberNodeState: (nodeState) =>
    set((state) => ({ ChamberNode: { ...state.ChamberNode, ...nodeState } })),
  setRHEEDAINodeState: (nodeState) =>
    set((state) => ({ RHEEDAINode: { ...state.RHEEDAINode, ...nodeState } })),
  setStorageNodeState: (nodeState) =>
    set((state) => ({ StorageNode: { ...state.StorageNode, ...nodeState } })),
}));

export default useServerStore;
