import { create } from "zustand";

import { FFTResult, STFTSample } from "../generated/lumi";

/**
 * The rolling STFT cache the spectrum chart plots from.
 *
 * `rheed.stft` emits one `STFTSample` per box per window, so unlike the
 * integrator there is no fan-out -- each sample carries its own `bbox_id`. The
 * cache is keyed the same way (`String(bbox_id)`, which is the frontend
 * detection id) so the visualizer can index it with `focusedDetectionID`.
 *
 * Only the most recent windows are worth keeping: the chart draws the latest
 * spectrum, and each `FFTResult` holds full frequency/magnitude/phase arrays.
 */
export interface STFTCacheEntry {
  content: FFTResult;
}
export type STFTCache = { [bboxKey: string]: STFTCacheEntry[] };

const DEFAULT_MAX_CACHE_SIZE = 20;

interface STFTState {
  cache: STFTCache;
  maxCacheSize: number;

  setMaxCacheSize: (maxCacheSize: number) => void;
  appendSamples: (samples: STFTSample[]) => void;
  /** Drops one box's windows when it is unregistered, so it stops being charted. */
  clearBox: (bboxKey: string) => void;
  reset: () => void;
}

const useSTFTStore = create<STFTState>((set) => ({
  cache: {},
  maxCacheSize: DEFAULT_MAX_CACHE_SIZE,

  setMaxCacheSize: (maxCacheSize) => set({ maxCacheSize }),

  appendSamples: (samples) =>
    set((state) => {
      if (samples.length === 0) return state;

      const cache: STFTCache = { ...state.cache };
      for (const sample of samples) {
        const bboxKey = String(sample.bbox_id);
        const windows = (cache[bboxKey] ?? []).concat({ content: sample.result });
        const overflow = windows.length - state.maxCacheSize;
        cache[bboxKey] = overflow > 0 ? windows.slice(overflow) : windows;
      }
      return { cache };
    }),

  clearBox: (bboxKey) =>
    set((state) => {
      if (!(bboxKey in state.cache)) return state;
      const cache = { ...state.cache };
      delete cache[bboxKey];
      return { cache };
    }),

  reset: () => set({ cache: {} }),
}));

export default useSTFTStore;
