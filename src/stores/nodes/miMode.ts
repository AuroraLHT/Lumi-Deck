import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { Node, NodeState } from "./base";

export interface MIModeNodeState extends NodeState {
  /**
   * How many executions the *node* is still holding: queued plus running.
   *
   * Not a lifetime total. The node drops an execution as soon as it finishes,
   * so this falls back to 0 between scripts even though several have run.
   */
  num_executions: number;
  /** `commands_uuid` of the script the node is working on, or null when idle. */
  current_execution: string | null;
}

// `Node`, not `StreamNode`: mi_mode is a PUBSUB capability, and the backend
// starts its update loop with the server rather than gating it behind
// start_stream (`base/mq/server.py:166`). Nothing ever sets `is_streaming` on
// this capability, so carrying the field would only invite the UI to read a flag
// that is permanently false.
type MIModeNode = Node<MIModeNodeState>;

const useMIModeNodeStore = create<MIModeNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      num_executions: 0,
      current_execution: null,
    },
    setState: (newState) =>
      set((state) => {
        Object.assign(state.state, newState);
      }),
  }))
);

export default useMIModeNodeStore;
