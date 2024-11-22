import { create } from "zustand";
import { NodeState, Node } from "./base";
import { immer } from "zustand/middleware/immer";

interface MIModeNodeState extends NodeState {
  is_streaming: boolean;
  latest_executed_commands_uuid : string;
  num_executions : number;
}

interface MIModeNode extends Node<MIModeNodeState> {
  setStreaming: (isStreaming: boolean) => void;
  setLatestExecutedCommandsUUID: (uuid: string) => void;
  setNumExecutions: (numExecutions: number) => void;
}


const useMIModeNodeStore = create<MIModeNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      latest_executed_commands_uuid: "",
      num_executions: 0,
    },
    setStreaming: (isStreaming) => set((state) => {
      state.state.is_streaming = isStreaming;
    }),
    setLatestExecutedCommandsUUID: (uuid: string) => set((state) => {
      state.state.latest_executed_commands_uuid = uuid;
    }),
    setNumExecutions: (numExecutions: number) => set((state) => {
      state.state.num_executions = numExecutions;
    }),
    setState: (newState) => set((state) => {
      Object.assign(state.state, newState);
    }),
  }))
);

export default useMIModeNodeStore;
