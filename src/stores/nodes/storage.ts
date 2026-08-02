import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { StreamNode, StreamNodeState } from "./base";

export interface StorageNodeState extends StreamNodeState {
  /**
   * Whether the *node* is recording -- not whether this browser started it.
   *
   * Recording is server-side state shared by every client, so this has to come
   * from the node rather than from a local flag set on click. It rides the 2s
   * heartbeat, which means a session another operator started (or one that
   * outlived this page's last reload) shows up here without anything polling.
   */
  is_storing: boolean;
  project_name: string | null;
  path: string | null;
  /**
   * Which source equipment the node can currently see. Storage is a consumer
   * with no equipment of its own, so it can be perfectly up and still unable to
   * record because RHEED or the chamber is down -- that is what this says.
   */
  deps_available: Record<string, boolean>;
}

// An alias, not `interface ... extends ... {}`: an interface with no members of
// its own is exactly its supertype, which eslint flags.
type StorageNode = StreamNode<StorageNodeState>;

const useStorageNodeStore = create<StorageNode>()(
  immer((set) => ({
    state: {
      is_available: false,
      is_running: false,
      is_streaming: false,
      is_storing: false,
      project_name: null,
      path: null,
      deps_available: {},
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

export default useStorageNodeStore;
