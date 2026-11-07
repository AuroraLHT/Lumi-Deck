import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { StreamNode, StreamNodeState } from "./base";

export interface ChamberPldNodeState extends StreamNodeState {
  /** 'legacy-mi' means every chamber.pld op is refused -- the chamber runs through chamber.mi_mode instead. */
  driver: "pld" | "legacy-mi" | null;
  address: string | null;
  /** Every port the service polls answered in the last cycle. */
  connected: boolean;
  backend: string | null;
  /** Client holding control, "" = nobody. Can lag an actual change by about a poll (pld-service). */
  controller: string | null;
  holds_control: boolean;
  read_only: boolean;
  /** null = no laser link at all, distinct from false (the second PC holds CM). */
  laser_control: boolean | null;
  log_file: string | null;
  error: string | null;
}

type ChamberPldNode = StreamNode<ChamberPldNodeState>;

const useChamberPldNodeStore = create<ChamberPldNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      driver: null,
      address: null,
      connected: false,
      backend: null,
      controller: null,
      holds_control: false,
      read_only: false,
      laser_control: null,
      log_file: null,
      error: null,
    },
    setState: (newState) =>
      set((state) => {
        Object.assign(state.state, newState);
      }),
    setStreaming: (isStreaming) =>
      set((state) => {
        state.state.is_streaming = isStreaming;
      }),
  }))
);

export default useChamberPldNodeStore;
