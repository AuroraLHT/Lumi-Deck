import { create } from "zustand";

import { PixelCheckStatus } from "../generated/lumi";

/** One finished long-running op, as reported on the driver's `pending` channel. */
export interface DriverTaskResult {
  /** The op that produced it (`auto_align_center_mask`, `anneal`, ...), from the event's `finished_task`. */
  kind: string | null;
  taskId: string | null;
  /** `Date.now()` when the result arrived, or the driver's `last_task.finished_at` for a seeded one. */
  finishedAt: number;
  ok: boolean;
  /** Set when `ok` is false: the backend's `"<ExceptionType>: <message>"`. */
  error: string | null;
  /** The whole `task_result`, for the op-specific fields. */
  data: Record<string, unknown>;
}

/** Enough for a session's calibration runs, without growing unbounded. */
const MAX_RESULTS = 20;

/**
 * What the experiment driver says only once.
 *
 * A task's result arrives on the `pending` channel as the task ends, and only
 * the latest one is queryable afterwards (`getState().last_task`). So the
 * history has to be caught and kept by a subscriber that is always mounted
 * (`useExperimentDriverStream`) -- the same reason `stores/miMode.ts` exists;
 * `last_task` only fills in the latest after a reload or a missed event.
 *
 * `pixelStatus` is here for a similar reason: the per-pixel check's position
 * comes back as the *reply* to `begin_check_rheed_pixels` /
 * `resolve_pixel_check`, not on the state, and whichever control made the
 * call is not necessarily the one showing the prompt.
 */
interface ExperimentDriverState {
  /** Oldest first. */
  results: DriverTaskResult[];
  pixelStatus: PixelCheckStatus | null;

  addResult: (result: DriverTaskResult) => void;
  /**
   * Adds a result unless one with its task id is already kept -- for the
   * driver's `last_task`, which every `getState()` repeats until the next
   * task finishes.
   */
  seedResult: (result: DriverTaskResult) => void;
  setPixelStatus: (status: PixelCheckStatus | null) => void;
  reset: () => void;
}

const useExperimentDriverStore = create<ExperimentDriverState>((set) => ({
  results: [],
  pixelStatus: null,

  addResult: (result) =>
    set((state) => ({ results: [...state.results, result].slice(-MAX_RESULTS) })),

  seedResult: (result) =>
    set((state) =>
      result.taskId != null && state.results.some((r) => r.taskId === result.taskId)
        ? state
        : {
            results: [...state.results, result]
              .sort((a, b) => a.finishedAt - b.finishedAt)
              .slice(-MAX_RESULTS),
          }
    ),

  setPixelStatus: (pixelStatus) => set({ pixelStatus }),

  reset: () => set({ results: [], pixelStatus: null }),
}));

export default useExperimentDriverStore;
