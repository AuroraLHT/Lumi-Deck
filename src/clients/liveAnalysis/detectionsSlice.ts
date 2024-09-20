import { StateCreator } from "zustand";
import {
  DetectionPayload,
  DetectionBboxes,
  DetectionClassification,
  DetectionRegion2Tracks,
  DetectionHeader,
  DetectionBase,
} from "../../entities/detector";

export interface DetectionStore {
  bboxes: DetectionBboxes;
  classification: DetectionClassification;
  region2tracks: DetectionRegion2Tracks;

  cache: DetectionBase[];

  cropSetup: {
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  } | null;

  maxCacheSize: number;
  setMaxCacheSize: (maxCacheSize: number) => void;
  updateFromPayload: (
    payload: DetectionPayload,
    header: DetectionHeader
  ) => void;
}

const createDetectionSlice: StateCreator<
  DetectionStore,
  [["zustand/immer", never]],
  [],
  DetectionStore
> = (set) => ({
  bboxes: {},
  classification: {},
  region2tracks: {},
  cache: [] as DetectionBase[],
  cropSetup: null,
  maxCacheSize: 200,

  setMaxCacheSize: (maxCacheSize: number) =>
    set((state) => {
      state.maxCacheSize = maxCacheSize;
    }),
  updateFromPayload: (payload: DetectionPayload, header: DetectionHeader) => {
    set((state) => {
      state.bboxes = payload.bboxes as DetectionBboxes;
      state.classification = payload.classification as DetectionClassification;
      state.region2tracks = payload.region2tracks as DetectionRegion2Tracks;

      // cache do not store the mask, other wise it will take too much memory
      const cache_bboxes = Object.fromEntries(
        Object.entries(payload.bboxes).map(([key, value]) => [
          key,
          {
            bbox: value.bbox,
            label: value.label,
            score: value.score,
          },
        ])
      );

      state.cache.push({
        bboxes: cache_bboxes,
        classification: payload.classification as DetectionClassification,
        region2tracks: payload.region2tracks as DetectionRegion2Tracks,
        header: header as DetectionHeader,
      });
      // console.log(state.cache.length);

      // Remove the first element if the cache size exceeds the limit
      if (state.cache.length > state.maxCacheSize) state.cache.shift();

      state.cropSetup = {
        sx: header.crop_setup_sx,
        sy: header.crop_setup_sy,
        ex: header.crop_setup_ex,
        ey: header.crop_setup_ey,
      };
    });
  },
});

export default createDetectionSlice;
