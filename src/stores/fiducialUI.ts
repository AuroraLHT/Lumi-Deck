import { create } from "zustand";

export type FiducialShapeTool = "cross" | "rect" | "poly";

/**
 * UI-only state shared between the Chamber Camera panel (where markers are
 * drawn) and the Fiducial Trace panel (where a marker's history is charted).
 *
 * The two are separate dashboard panels with no parent between them -- same
 * situation as `redrawTargetID` in `stores/liveAnalysis.ts` -- so "which marker
 * is the trace panel showing" has to live somewhere both can reach.
 */
interface FiducialUIState {
  selectedMarkerId: string | null;
  /** Non-null while the overlay is armed to draw a new marker of this shape. */
  activeTool: FiducialShapeTool | null;

  selectMarker: (id: string | null) => void;
  setActiveTool: (tool: FiducialShapeTool | null) => void;
}

const useFiducialUIStore = create<FiducialUIState>((set) => ({
  selectedMarkerId: null,
  activeTool: null,

  selectMarker: (id) => set({ selectedMarkerId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
}));

export default useFiducialUIStore;
