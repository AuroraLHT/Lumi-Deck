import { create } from "zustand";

export type FiducialShapeTool = "cross" | "circle" | "rect" | "poly";

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
  /** Declutters the video without touching the registry -- the markers are
   * still there, just not drawn on top of the feed. */
  markersHidden: boolean;

  selectMarker: (id: string | null) => void;
  setActiveTool: (tool: FiducialShapeTool | null) => void;
  setMarkersHidden: (hidden: boolean) => void;
}

const useFiducialUIStore = create<FiducialUIState>((set) => ({
  selectedMarkerId: null,
  activeTool: null,
  markersHidden: false,

  selectMarker: (id) => set({ selectedMarkerId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setMarkersHidden: (hidden) => set({ markersHidden: hidden }),
}));

export default useFiducialUIStore;
