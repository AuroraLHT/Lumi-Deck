import { create } from "zustand";

import { NodeRecord } from "../generated/lumi";

/**
 * Node presence from the backend's SystemRegistry.
 *
 * This is a store rather than per-caller hook state because more than one
 * consumer needs it (the Server Nodes panel and `useNodeStates`), and
 * `LumiTransport.subscribe` keys handlers by `target:stream` in a map: a second
 * subscriber to `system.registry:registry_event` silently replaced the first,
 * and whichever unmounted first sent an `unsubscribe` that killed the live feed
 * for the other. One owner (`useSystemRegistryStream`) fills this; everyone else
 * reads it.
 */
interface SystemRegistryState {
  nodes: Record<string, NodeRecord>;
  isLoading: boolean;
  error: Error | null;

  setNodes: (nodes: Record<string, NodeRecord>) => void;
  upsertNode: (node: NodeRecord) => void;
  setError: (error: Error | null) => void;
  reset: () => void;
}

const useSystemRegistryStore = create<SystemRegistryState>((set) => ({
  nodes: {},
  isLoading: true,
  error: null,

  setNodes: (nodes) => set({ nodes, isLoading: false, error: null }),
  upsertNode: (node) =>
    set((state) => ({ nodes: { ...state.nodes, [node.instance_id]: node } })),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ nodes: {}, isLoading: true, error: null }),
}));

export default useSystemRegistryStore;
