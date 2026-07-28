import { create } from "zustand";

import { DetectionOverlay } from "../generated/lumi";
import {
  DetectionBboxes,
  DetectionBase,
  DetectionClassification,
} from "../entities/detector";

/**
 * The latest detections plus a rolling history, for the video overlay and the
 * classification chart.
 *
 * Fed from `detection.overlay`, which is the masks-and-pattern-free view of
 * `detection.detection` -- exactly what a browser needs to draw boxes, without
 * the heavy arrays travelling to every viewer.
 *
 * The overlay reports each box as origin + extent (`x, y, width, height`) while
 * the rectangle components were written against the old corner form
 * `[x1, y1, x2, y2]`, so boxes are converted on the way in and the components
 * stay unchanged.
 */
const DEFAULT_MAX_CACHE_SIZE = 200;

/** Corner form, as the rectangle components expect it. */
export interface CropSetupRect {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
}

interface DetectionState {
  bboxes: DetectionBboxes;
  classification: DetectionClassification;
  cache: DetectionBase[];
  /**
   * The detector's crop window. Unlike the old protocol this does not ride on
   * every frame -- it is capability state, so it is read once per connection and
   * whenever it is changed.
   */
  cropSetup: CropSetupRect | null;
  maxCacheSize: number;

  setMaxCacheSize: (maxCacheSize: number) => void;
  setCropSetup: (crop: CropSetupRect | null) => void;
  applyOverlay: (overlay: DetectionOverlay) => void;
  reset: () => void;
}

const useDetectionStore = create<DetectionState>((set) => ({
  bboxes: {},
  classification: {},
  cache: [],
  cropSetup: null,
  maxCacheSize: DEFAULT_MAX_CACHE_SIZE,

  setMaxCacheSize: (maxCacheSize) => set({ maxCacheSize }),
  setCropSetup: (cropSetup) => set({ cropSetup }),

  applyOverlay: (overlay) =>
    set((state) => {
      const bboxes: DetectionBboxes = {};
      for (const box of overlay.boxes ?? []) {
        bboxes[String(box.bbox_id)] = {
          bbox: [box.x, box.y, box.x + box.width, box.y + box.height],
          // The overlay labels boxes with a string; the rectangles only use this
          // for display, and the legacy shape typed it as a class index.
          label: Number(box.label ?? 0),
          score: box.score,
        };
      }

      // The chart calls parseFloat on these, so normalise the probabilities to
      // strings the way the old payload delivered them.
      const classification: DetectionClassification = {};
      for (const [name, probability] of Object.entries(overlay.classification ?? {})) {
        classification[name] = String(probability);
      }

      const cache = state.cache.concat({
        bboxes,
        classification,
        region2tracks: {},
        header: {
          // The crop is capability state now, not per-frame; it is kept in
          // `cropSetup` and the cached entries do not carry a copy.
          crop_setup_sx: 0,
          crop_setup_sy: 0,
          crop_setup_ex: 0,
          crop_setup_ey: 0,
          time: overlay.time,
          time_stamp: overlay.time_stamp.replace(" ", "T"),
          uuid: overlay.uuid,
        },
      });
      const overflow = cache.length - state.maxCacheSize;

      return {
        bboxes,
        classification,
        cache: overflow > 0 ? cache.slice(overflow) : cache,
      };
    }),

  reset: () => set({ bboxes: {}, classification: {}, cache: [], cropSetup: null }),
}));

export default useDetectionStore;
