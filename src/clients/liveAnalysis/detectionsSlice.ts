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

  cacheDetection: DetectionBase[];

  cropSetup: {
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  } | null;

  maxDetectionCacheSize: number;
  setMaxDetectionCacheSize: (maxCacheSize: number) => void;
  updateDetectionFromPayload: (
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
  cacheDetection: [] as DetectionBase[],
  cropSetup: null,
  maxDetectionCacheSize: 200,

  setMaxDetectionCacheSize: (maxCacheSize: number) =>
    set((state) => {
      state.maxDetectionCacheSize = maxCacheSize;
    }),
  updateDetectionFromPayload: (payload: DetectionPayload, header: DetectionHeader) => {
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

      state.cacheDetection.push({
        bboxes: cache_bboxes,
        classification: payload.classification as DetectionClassification,
        region2tracks: payload.region2tracks as DetectionRegion2Tracks,
        header: header as DetectionHeader,
      });
      // console.log(state.cache.length);

      // Remove the first element if the cache size exceeds the limit
      if (state.cacheDetection.length > state.maxDetectionCacheSize) state.cacheDetection.shift();

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
