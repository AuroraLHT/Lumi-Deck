// store.ts
import { create } from "zustand";
import { DetectionBBox } from "../entities/detector";
import { immer } from "zustand/middleware/immer";

export interface SelectedDetection extends DetectionBBox {
  id: string;
  name: string;
  isRunningSTFT: boolean;
  isRunningOscillation: boolean;
}

interface LiveAnalysisState {
  detectionNextID: number;
  selectedDetection: { [key: string]: SelectedDetection };
  focusedDetectionID: string | null;
  addSelectedDetection: (detection: DetectionBBox, name?: string) => void;
  removeSelectedDetection: (key: string) => void;
  setFocusedDetectionID: (id: string) => void;
  updateFocusedDetection: (update: Partial<SelectedDetection>) => void;
  getFocusedDetection: () => SelectedDetection | null;
}

const useLiveAnalysisStore = create(
  immer<LiveAnalysisState>((set, get) => ({
    detectionNextID: 0,
    focusedDetectionID: null,
    selectedDetection: {},

    addSelectedDetection: (detection: DetectionBBox, name?: string) => 
      set((state) => {
        const id = state.detectionNextID.toString();
        state.detectionNextID += 1;
        state.selectedDetection[id] = {
          ...detection,
          id,
          name: name || `Box ${id}`,
          isRunningSTFT: false,
          isRunningOscillation: false,
        };
      }),

    removeSelectedDetection: (key: string) =>
      set((state) => {
        delete state.selectedDetection[key];
      }),

    setFocusedDetectionID: (id: string) =>
      set((state) => {
        state.focusedDetectionID = id;
      }),
    
    updateFocusedDetection: (update: Partial<SelectedDetection>) =>
      set((state) => {
        if (state.focusedDetectionID) {
          state.selectedDetection[state.focusedDetectionID] = {
            ...state.selectedDetection[state.focusedDetectionID],
          ...update,
          };
        }
      }),

    getFocusedDetection: () => {
      const state = get();
      if (state.focusedDetectionID) {
        return state.selectedDetection[state.focusedDetectionID];
      }
      return null;
    },

  }))
);

export default useLiveAnalysisStore;
