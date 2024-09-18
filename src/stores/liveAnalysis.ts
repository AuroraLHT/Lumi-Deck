// store.ts
import { create } from "zustand";
import { DetectionBBox } from "../entities/detector";
import { immer } from "zustand/middleware/immer";

interface SelectedDetection extends DetectionBBox {
  id: string;
  name: string;
}

interface LiveAnalysisState {
  detectionNextID: number;
  selectedDetection: { [key: string]: SelectedDetection };
  addSelectedDetection: (detection: DetectionBBox, name?: string) => void;
  removeSelectedDetection: (key: string) => void;
}

const useLiveAnalysisStore = create(
  immer<LiveAnalysisState>((set) => ({
    detectionNextID: 0,
    selectedDetection: {},

    addSelectedDetection: (detection: DetectionBBox, name?: string) => 
      set((state) => {
        const id = state.detectionNextID.toString();
        state.detectionNextID += 1;
        state.selectedDetection[id] = {
          ...detection,
          id,
          name: name || `Box ${id}`,
        };
      }),

    removeSelectedDetection: (key: string) =>
      set((state) => {
        delete state.selectedDetection[key];
      }),
  }))
);

export default useLiveAnalysisStore;
