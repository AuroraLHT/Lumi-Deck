import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  BeamSpec,
  Morphology,
  Reconstruction,
  RenderSpec,
  RheedJpegRequest,
  RheedSimRequest,
  RheedSpot,
} from "../generated/lumi";

export type Index3 = [number, number, number];
export type SpotKind = RheedSpot["kind"];
export type IntensityScale = NonNullable<RheedJpegRequest["scale"]>;

export const SPOT_KINDS: SpotKind[] = ["rod", "fractional", "streak_max", "bulk"];

/**
 * The scene being simulated: what the Simulation page edits and what the
 * spot overlay on the live camera (and on a recorded frame) draws. One scene
 * for both, so tuning it on the page is tuning the overlay.
 *
 * Fields left at their contract defaults are still written out, so the form
 * always shows a value. `beam.energy_kev` null is the lab's usual energy, and
 * there is no `screen`: every request uses the lab camera's fitted screen.
 */
export interface SimScene {
  structure: string;
  normal: Index3;
  azimuth: Index3;
  azimuthOffsetDeg: number;
  /**
   * An index into the last result's `mesh.terminations` (top-first); null = the
   * plane the cell puts highest. An index, not the composition: two planes of
   * one cut can share a composition (the two O planes of fluorite (111)).
   */
  termination: number | null;
  reconstructions: Reconstruction[];
  beam: Required<Omit<BeamSpec, "energy_kev">> & { energy_kev: number | null };
  morphology: Required<Omit<Morphology, "layers">>;
  render: Required<Omit<RenderSpec, "seed">>;
  scale: IntensityScale;
}

export const DEFAULT_SCENE: SimScene = {
  structure: "SrTiO3",
  normal: [0, 0, 1],
  azimuth: [1, 0, 0],
  azimuthOffsetDeg: 0,
  termination: null,
  reconstructions: [],
  beam: { energy_kev: null, incidence_deg: 1.89, divergence_mrad: 0.3 },
  morphology: { terrace_nm: 50, islands: 0, island_nm: 5, mean_free_path_nm: 10, debye_waller_b: 0.5 },
  render: { background: 0.03, blur_px: 1, direct_beam: true, noise_counts: 0 },
  scale: "sqrt",
};

/**
 * The scenes the lab screen was fitted to (backend docs/RHEED_SIMULATION.md §12):
 * real frames at 25 keV, which the simulated camera also shows
 * (`start_simulation.sh --substrate sto|ysz`). Picking one lines the overlay
 * up with that feed. Energy stays the lab default and no screen is sent.
 */
export const LAB_SCENES: { key: string; label: string; scene: Partial<SimScene> & { incidence_deg: number } }[] = [
  {
    key: "sto",
    label: "SrTiO3(001) [100] · 1.89°",
    scene: { structure: "SrTiO3", normal: [0, 0, 1], azimuth: [1, 0, 0], incidence_deg: 1.89 },
  },
  {
    key: "ysz",
    label: "YSZ(111) [1-10] · 1.63°",
    scene: { structure: "YSZ", normal: [1, 1, 1], azimuth: [1, -1, 0], incidence_deg: 1.63 },
  },
];

/** h*u + k*v + l*w: the azimuth has to lie in the surface plane, so this must be 0. */
export const inPlane = (normal: Index3, azimuth: Index3) =>
  normal[0] * azimuth[0] + normal[1] * azimuth[1] + normal[2] * azimuth[2] === 0;

/** The spots-only request: no image, so no render or scale. */
export const spotsRequest = (scene: SimScene, energyKev?: number | null): RheedSimRequest => ({
  structure: { name: scene.structure },
  surface: {
    normal: scene.normal,
    azimuth: scene.azimuth,
    azimuth_offset_deg: scene.azimuthOffsetDeg,
    termination: scene.termination,
    reconstructions: scene.reconstructions,
  },
  beam: { ...scene.beam, energy_kev: energyKev === undefined ? scene.beam.energy_kev : energyKev },
  morphology: scene.morphology,
});

export const imageRequest = (scene: SimScene): RheedJpegRequest => ({
  ...spotsRequest(scene),
  render: scene.render,
  scale: scene.scale,
});

interface RheedSimStore {
  scene: SimScene;
  /** Draw the scene's spots over the live RHEED camera. */
  overlayOnLive: boolean;
  /** Which spot kinds the overlays and the page draw. */
  shownKinds: SpotKind[];
  showLabels: boolean;

  setScene: (patch: Partial<SimScene>) => void;
  resetScene: () => void;
  setOverlayOnLive: (on: boolean) => void;
  toggleKind: (kind: SpotKind) => void;
  setShowLabels: (on: boolean) => void;
}

/**
 * Kept in this browser (localStorage): a scene is a viewer's working state,
 * not a record, and a reload should not lose the orientation they dialled in.
 */
const useRheedSimStore = create<RheedSimStore>()(
  persist(
    (set) => ({
      scene: DEFAULT_SCENE,
      overlayOnLive: false,
      shownKinds: [...SPOT_KINDS],
      showLabels: true,

      setScene: (patch) => set((s) => ({ scene: { ...s.scene, ...patch } })),
      resetScene: () => set({ scene: DEFAULT_SCENE }),
      setOverlayOnLive: (on) => set({ overlayOnLive: on }),
      toggleKind: (kind) =>
        set((s) => ({
          shownKinds: s.shownKinds.includes(kind)
            ? s.shownKinds.filter((k) => k !== kind)
            : SPOT_KINDS.filter((k) => k === kind || s.shownKinds.includes(k)),
        })),
      setShowLabels: (on) => set({ showLabels: on }),
    }),
    {
      name: "lumi-rheed-sim",
      version: 1,
      // A scene saved by an older build may lack a field added since: fill it
      // from the defaults rather than send the node an undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<RheedSimStore>;
        return {
          ...current,
          ...p,
          scene: {
            ...DEFAULT_SCENE,
            ...p.scene,
            beam: { ...DEFAULT_SCENE.beam, ...p.scene?.beam },
            morphology: { ...DEFAULT_SCENE.morphology, ...p.scene?.morphology },
            render: { ...DEFAULT_SCENE.render, ...p.scene?.render },
            termination: typeof p.scene?.termination === "number" ? p.scene.termination : null,
          },
        };
      },
    }
  )
);

export default useRheedSimStore;
