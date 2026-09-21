import { create } from "zustand";

import { MarkerStats, MarkerStatsSample } from "../generated/lumi";

/**
 * The rolling per-marker stats cache the calibration trace chart plots from,
 * and the latest sample the overlay's live readout labels draw from.
 *
 * Mirrors `stores/integrator.ts`: the backend's `chamber.fiducial` capability
 * emits one `MarkerStatsSample` per frame holding `stats` for *every* marker at
 * once, keyed by `marker_id`. The chart wants a per-marker series, so samples
 * are fanned out into `{ [markerId]: [{ stats, header, x }] }`.
 */
export interface FiducialStatsCacheEntry {
  stats: MarkerStats;
  time: number;
  timeStamp: string;
  /** Parsed once here rather than on every render -- see `stores/integrator.ts`. */
  x: Date;
}
export type FiducialStatsCache = { [markerId: string]: FiducialStatsCacheEntry[] };

const DEFAULT_MAX_CACHE_SIZE = 5000;

interface FiducialStatsState {
  cache: FiducialStatsCache;
  /** Every marker's stats from the most recently applied sample. */
  latest: Record<string, MarkerStats>;
  maxCacheSize: number;

  appendSamples: (samples: MarkerStatsSample[]) => void;
  /** Drops one marker's series when it is removed, so it stops being charted. */
  clearMarker: (markerId: string) => void;
  reset: () => void;
}

/** Same non-ISO form the chamber's other headers use; see `stores/integrator.ts`. */
const parseTimeStamp = (timeStamp: string): Date => new Date(timeStamp.replace(" ", "T"));

const useFiducialStatsStore = create<FiducialStatsState>((set) => ({
  cache: {},
  latest: {},
  maxCacheSize: DEFAULT_MAX_CACHE_SIZE,

  appendSamples: (samples) =>
    set((state) => {
      if (samples.length === 0) return state;

      const additions = new Map<string, FiducialStatsCacheEntry[]>();
      let latest: Record<string, MarkerStats> = state.latest;
      for (const sample of samples) {
        const x = parseTimeStamp(sample.time_stamp);
        latest = sample.stats;
        for (const [markerId, stats] of Object.entries(sample.stats)) {
          const entry: FiducialStatsCacheEntry = {
            stats,
            time: sample.time,
            timeStamp: sample.time_stamp,
            x,
          };
          const existing = additions.get(markerId);
          if (existing) existing.push(entry);
          else additions.set(markerId, [entry]);
        }
      }

      const cache: FiducialStatsCache = { ...state.cache };
      for (const [markerId, entries] of additions) {
        const series = (cache[markerId] ?? []).concat(entries);
        const overflow = series.length - state.maxCacheSize;
        cache[markerId] = overflow > 0 ? series.slice(overflow) : series;
      }
      return { cache, latest };
    }),

  clearMarker: (markerId) =>
    set((state) => {
      if (!(markerId in state.cache)) return state;
      const cache = { ...state.cache };
      delete cache[markerId];
      const latest = { ...state.latest };
      delete latest[markerId];
      return { cache, latest };
    }),

  reset: () => set({ cache: {}, latest: {} }),
}));

export default useFiducialStatsStore;
