import { create } from "zustand";

import { IntegrationHeader, IntegrationResult, IntegrationSample } from "../generated/lumi";

/**
 * The rolling integrator cache the Oscillation chart plots from.
 *
 * The backend's `rheed.integrator` capability emits one `IntegrationSample` per
 * frame holding `results` for *every* registered box at once, keyed by the box's
 * `bbox_id` as a string. The chart instead wants a per-box series, so samples are
 * fanned out into `{ [bboxKey]: [{ content, header }] }` -- the shape the
 * visualizer already indexes with `focusedDetectionID`.
 *
 * The key is `String(bbox_id)`, and boxes are registered under the frontend's own
 * detection id (see `useAnalyzerControl`), so `cache[focusedDetectionID]` is the
 * focused box's series.
 */
export interface IntegrationCacheEntry {
  content: IntegrationResult;
  header: IntegrationHeader;
  /**
   * The sample's timestamp, parsed once here rather than on every render.
   *
   * This is a performance fix, not a convenience: the chart used to do
   * `new Date(item.header.time_stamp)` across the whole cache on each render,
   * so a saturated 5000-entry cache meant 5000 date-string parses per render at
   * ~26 renders/second. That is what made the page degrade after a few minutes.
   */
  x: Date;
}
export type IntegrationCache = { [bboxKey: string]: IntegrationCacheEntry[] };

const DEFAULT_MAX_CACHE_SIZE = 5000;

interface IntegratorState {
  cache: IntegrationCache;
  maxCacheSize: number;

  setMaxCacheSize: (maxCacheSize: number) => void;
  appendSamples: (samples: IntegrationSample[]) => void;
  /** Drops one box's series when it is unregistered, so it stops being charted. */
  clearBox: (bboxKey: string) => void;
  reset: () => void;
}

/**
 * The node stamps `time_stamp` as "YYYY-MM-DD HH:mm:ss.ssssss". `new Date` on that
 * form is not part of the ES spec -- V8 accepts it, other engines return Invalid
 * Date -- so it is normalised to ISO here, where the charts call `new Date` on it.
 */
const normaliseHeader = (header: IntegrationHeader): IntegrationHeader => ({
  ...header,
  time_stamp: header.time_stamp.replace(" ", "T"),
});

const useIntegratorStore = create<IntegratorState>((set) => ({
  cache: {},
  maxCacheSize: DEFAULT_MAX_CACHE_SIZE,

  setMaxCacheSize: (maxCacheSize) => set({ maxCacheSize }),

  appendSamples: (samples) =>
    set((state) => {
      if (samples.length === 0) return state;

      // Group the batch by box first, so a flush of N samples costs one array
      // copy per box instead of N.
      const additions = new Map<string, IntegrationCacheEntry[]>();
      for (const sample of samples) {
        const header = normaliseHeader(sample.header);
        const x = new Date(header.time_stamp);
        for (const [bboxKey, content] of Object.entries(sample.results)) {
          const entry = { content, header, x };
          const existing = additions.get(bboxKey);
          if (existing) existing.push(entry);
          else additions.set(bboxKey, [entry]);
        }
      }

      // Copy-on-write per box: the visualizer re-renders off a changed series
      // reference, so only the boxes present in this batch get a new array.
      const cache: IntegrationCache = { ...state.cache };
      for (const [bboxKey, entries] of additions) {
        const series = (cache[bboxKey] ?? []).concat(entries);
        const overflow = series.length - state.maxCacheSize;
        cache[bboxKey] = overflow > 0 ? series.slice(overflow) : series;
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

export default useIntegratorStore;
