import { create } from "zustand";

import { PixelCheckStatus } from "../generated/lumi";

/** One finished long-running op, as reported on the driver's `pending` channel. */
export interface DriverTaskResult {
  /** The op that produced it (`auto_align_center_mask`, `anneal`, ...), from the event's `finished_task`. */
  kind: string | null;
  taskId: string | null;
  /** `Date.now()` when the result arrived. */
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
 * A task's result is never queryable: it arrives on the `pending` channel as
 * the task ends, and `getState()` afterwards just shows no task. So it has to
 * be caught and kept by a subscriber that is always mounted
 * (`useExperimentDriverStream`) -- the same reason `stores/miMode.ts` exists.
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
  setPixelStatus: (status: PixelCheckStatus | null) => void;
  reset: () => void;
}

const useExperimentDriverStore = create<ExperimentDriverState>((set) => ({
  results: [],
  pixelStatus: null,

  addResult: (result) =>
    set((state) => ({ results: [...state.results, result].slice(-MAX_RESULTS) })),

  setPixelStatus: (pixelStatus) => set({ pixelStatus }),

  reset: () => set({ results: [], pixelStatus: null }),
}));

export default useExperimentDriverStore;
