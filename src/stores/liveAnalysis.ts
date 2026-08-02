// store.ts
import { create } from "zustand";
import { DetectionBBox } from "../entities/detector";
import { immer } from "zustand/middleware/immer";
import type { RegisteredBox } from "../hooks/useRegisteredBoxes";

export interface SelectedDetection extends DetectionBBox {
  id: string;
  name: string;
  /**
   * Whether the *backend* is running this analysis on the box, not whether the
   * user has asked for it. Both flags are owned by `reconcileWithBackend` and
   * only ever set optimistically in between: a register that fails is corrected
   * on the next heartbeat, so a toggle can no longer sit "on" over a box the
   * node never accepted.
   */
  isRunningSTFT: boolean;
  isRunningOscillation: boolean;
  /**
   * False while the box exists only in this browser -- drawn, but not registered
   * with any capability, so no other client can see it and it will not survive a
   * reload.
   */
  isRegistered: boolean;
}

interface LiveAnalysisState {
  detectionNextID: number;
  selectedDetection: { [key: string]: SelectedDetection };
  focusedDetectionID: string | null;
  /**
   * The box the user is currently redrawing on the video, or null.
   *
   * The analyzer and the RHEED video are separate dashboard panels with no
   * parent between them, so "the next rectangle drawn replaces this box rather
   * than creating a new one" has to live here. `RectangleSelector` reads it when
   * a drag finishes; `VideoMain` reads it to arm the overlay without the user
   * having to reach for the manual-box button first.
   */
  redrawTargetID: string | null;
  addSelectedDetection: (detection: DetectionBBox, name?: string) => void;
  removeSelectedDetection: (key: string) => void;
  setFocusedDetectionID: (id: string) => void;
  updateFocusedDetection: (update: Partial<SelectedDetection>) => void;
  getFocusedDetection: () => SelectedDetection | null;
  /** Arm redraw mode for a box, focusing it so the user can see what they are moving. */
  beginRedraw: (id: string) => void;
  cancelRedraw: () => void;
  /**
   * Move a box. Corner form `[x1, y1, x2, y2]`, in camera-frame pixels.
   *
   * Only the geometry: the id (which is also the backend's bbox_id), the name
   * and the analysis flags are all preserved, so a redraw keeps the box's
   * identity rather than orphaning a registration under the old id. Pushing the
   * new coordinates to the node is the caller's job -- see
   * `useAnalyzerControl.applyGeometryChange`.
   */
  setDetectionBBox: (id: string, bbox: number[]) => void;
  /** Adopt the backend's registry; see the implementation for what it may touch. */
  reconcileWithBackend: (boxes: RegisteredBox[]) => void;
}

const useLiveAnalysisStore = create(
  immer<LiveAnalysisState>((set, get) => ({
    detectionNextID: 0,
    focusedDetectionID: null,
    redrawTargetID: null,
    selectedDetection: {},

    addSelectedDetection: (detection: DetectionBBox, name?: string) =>
      set((state) => {
        // The counter alone is not enough to guarantee a free id. It is bumped
        // past the node's highest bbox id by `reconcileWithBackend`, but that
        // has nothing to bump it past while the RHEED node is down -- and the
        // id doubles as the bbox id, so reusing one would overwrite whatever
        // box the node already has under it once it comes back.
        let next = state.detectionNextID;
        while (String(next) in state.selectedDetection) next += 1;
        const id = String(next);
        state.detectionNextID = next + 1;
        state.selectedDetection[id] = {
          ...detection,
          id,
          // Just the number. The sidebar is a narrow rail in a 4-of-12 panel and
          // "Box 12" was being clipped to nothing there; the geometry that used
          // to justify a longer label is in the row's tooltip instead.
          name: name || id,
          isRunningSTFT: false,
          isRunningOscillation: false,
          isRegistered: false,
        };
      }),

    removeSelectedDetection: (key: string) =>
      set((state) => {
        delete state.selectedDetection[key];
        // Focus pointed at a box that no longer exists left the analyzer
        // rendering charts for it. Clearing it also lets `reconcileWithBackend`
        // fill the focus with a box that is still registered.
        if (state.focusedDetectionID === key) state.focusedDetectionID = null;
        // Likewise a redraw armed at a box that has since been deleted: the next
        // drag would otherwise be swallowed instead of creating a new box.
        if (state.redrawTargetID === key) state.redrawTargetID = null;
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

    beginRedraw: (id: string) =>
      set((state) => {
        if (!(id in state.selectedDetection)) return;
        state.redrawTargetID = id;
        // The overlay highlights the focused box, so focusing it is what makes
        // "which one am I about to move?" answerable on the video itself.
        state.focusedDetectionID = id;
      }),

    cancelRedraw: () =>
      set((state) => {
        state.redrawTargetID = null;
      }),

    setDetectionBBox: (id: string, bbox: number[]) =>
      set((state) => {
        const detection = state.selectedDetection[id];
        if (!detection) return;
        detection.bbox = bbox;
        if (state.redrawTargetID === id) state.redrawTargetID = null;
      }),

    /**
     * Merge the backend's box registry in, so this UI lists every box the node
     * has -- including ones another client registered and ones that predate this
     * page load.
     *
     * Deliberately not a replace. A box the user drew but has not registered
     * exists only here, and blowing it away on the first heartbeat would make
     * drawing a box look broken. So backend boxes are added if missing, the
     * analysis flags are taken as gospel, and everything else is left alone.
     */
    reconcileWithBackend: (boxes: RegisteredBox[]) =>
      set((state) => {
        const registered = new Map(boxes.map((box) => [box.id, box]));

        for (const box of boxes) {
          const existing = state.selectedDetection[box.id];
          if (existing) {
            // The name is the user's, and the geometry is whichever of the two
            // is more precise -- the user drew floats, `toBBox` rounded them to
            // the integers the contract requires, and re-reading those back
            // would nudge the box on screen every heartbeat.
            existing.isRegistered = true;
            existing.isRunningOscillation = box.isIntegrating;
            existing.isRunningSTFT = box.isRunningSTFT;
            continue;
          }
          state.selectedDetection[box.id] = {
            bbox: box.corners,
            // The registry stores a region, not a detection: there is no class
            // and no confidence behind it. Matches what RectangleSelector uses
            // for a hand-drawn box.
            label: -1,
            score: 1,
            id: box.id,
            name: box.id,
            isRegistered: true,
            isRunningOscillation: box.isIntegrating,
            isRunningSTFT: box.isRunningSTFT,
          };
        }

        for (const [id, detection] of Object.entries(state.selectedDetection)) {
          if (registered.has(id)) continue;
          // Either never registered, or another client removed it. Both mean no
          // analysis is running, whatever this page last set the toggles to.
          detection.isRegistered = false;
          detection.isRunningOscillation = false;
          detection.isRunningSTFT = false;
        }

        // Ids are shared with the node: the frontend's detection id *is* the
        // bbox id. Handing out an id the node already uses would silently
        // overwrite someone else's box on the next register, so the counter has
        // to clear the highest id in use.
        const highest = boxes.reduce(
          (max, box) => Math.max(max, box.bboxId),
          -1
        );
        if (state.detectionNextID <= highest) {
          state.detectionNextID = highest + 1;
        }

        // On a fresh load nothing is focused and the analyzer sits empty even
        // though boxes are being integrated. Only ever fills a null focus, so it
        // cannot steal the selection from under the user.
        if (state.focusedDetectionID === null && boxes.length > 0) {
          state.focusedDetectionID = boxes[0].id;
        }
      }),

  }))
);

export default useLiveAnalysisStore;
