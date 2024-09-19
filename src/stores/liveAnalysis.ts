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
  focusedDetection: SelectedDetection | null;
  addSelectedDetection: (detection: DetectionBBox, name?: string) => void;
  removeSelectedDetection: (key: string) => void;
  setFocusedDetection: (detection: SelectedDetection) => void;
}

const useLiveAnalysisStore = create(
  immer<LiveAnalysisState>((set) => ({
    detectionNextID: 0,
    focusedDetection: {
      id: "-",
      name: "-",
      bbox: [],
      label: -1,
      score: -1,
    },
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

    setFocusedDetection: (detection: SelectedDetection) =>
      set((state) => {
        state.focusedDetection = detection;
      }),

  }))
);

export default useLiveAnalysisStore;
