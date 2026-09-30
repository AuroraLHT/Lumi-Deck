import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { Node, NodeState } from "./base";

export interface SimulationNodeState extends NodeState {
  /** Structures the node ships with, and ones saved through it. */
  n_builtin: number;
  n_saved: number;
}

type SimulationNode = Node<SimulationNodeState>;

/**
 * The simulation node: no equipment behind it, so this is only whether it is
 * up and what it has on its shelf. It rides the registry heartbeat like the
 * others (`useNodeStates`).
 */
const useSimulationNodeStore = create<SimulationNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      n_builtin: 0,
      n_saved: 0,
    },
    setState: (newState) =>
      set((state) => {
        Object.assign(state.state, newState);
      }),
  }))
);

export default useSimulationNodeStore;
