import { create } from "zustand";

import { MIExecution } from "../generated/lumi";

/**
 * The browser's record of MI-mode executions.
 *
 * This store exists because **the node forgets**. `MIModeServer` pops an
 * execution out of its `executions` map the moment it finishes
 * (`mi_mode.py: clean_up_mi_execution`), so `list_execution()` only ever returns
 * what is *queued or running*. A script that completed ten seconds ago is gone
 * from the server's answer entirely.
 *
 * The `execution` update channel is therefore the only place a terminal state is
 * ever observable: the state-change callback broadcasts `COMPLETED`/`ABORTED`
 * just before the cleanup that erases it. Miss that message and there is no way
 * to ask for it afterwards -- which is also why the subscription is mounted at
 * the transport provider rather than by the panel. Keeping history is the
 * client's job, and this is where it is kept.
 */

/** Enough to cover a growth run without letting a long session grow unbounded. */
const DEFAULT_MAX_HISTORY = 50;

interface MiModeState {
  /** First-seen order, oldest first. The UI reverses it for display. */
  executions: MIExecution[];
  /** `Date.now()` of the last update from the node; null until one arrives. */
  lastUpdateAt: number | null;
  maxHistory: number;

  /** Apply one update from the `execution` channel. Authoritative. */
  applyExecution: (execution: MIExecution) => void;
  /** Merge a `list_execution()` snapshot in without overwriting what we know. */
  seedExecutions: (executions: MIExecution[]) => void;
  reset: () => void;
}

const useMiModeStore = create<MiModeState>((set) => ({
  executions: [],
  lastUpdateAt: null,
  maxHistory: DEFAULT_MAX_HISTORY,

  applyExecution: (execution) =>
    set((state) => {
      const index = state.executions.findIndex(
        (e) => e.commands_uuid === execution.commands_uuid
      );

      // Replace in place rather than append: an execution emits an update per
      // state transition (LOAD -> LOADED -> RUNNING -> COMPLETED), and appending
      // would show the same script four times.
      if (index >= 0) {
        const executions = [...state.executions];
        executions[index] = execution;
        return { executions, lastUpdateAt: Date.now() };
      }

      const merged = [...state.executions, execution];
      const overflow = merged.length - state.maxHistory;
      return {
        executions: overflow > 0 ? merged.slice(overflow) : merged,
        lastUpdateAt: Date.now(),
      };
    }),

  seedExecutions: (executions) =>
    set((state) => {
      // Only fill in what we have never seen. The snapshot is taken at request
      // time, so it can be a moment behind an update that already landed --
      // letting it overwrite would flip a finished script back to RUNNING.
      const known = new Set(state.executions.map((e) => e.commands_uuid));
      const additions = executions.filter((e) => !known.has(e.commands_uuid));
      if (additions.length === 0) return state;

      const merged = [...state.executions, ...additions];
      const overflow = merged.length - state.maxHistory;
      return { executions: overflow > 0 ? merged.slice(overflow) : merged };
    }),

  reset: () => set({ executions: [], lastUpdateAt: null }),
}));

export default useMiModeStore;
