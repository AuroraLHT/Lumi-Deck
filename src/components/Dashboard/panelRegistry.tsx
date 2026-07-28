import { ReactNode } from "react";
import { LayoutItem } from "react-grid-layout";

import VideoMain from "../VideoPlayer/VideoMain";
import StorageMain from "../StorageRequest/StorageMain";
import MainController from "../MainController";
import RealTimeMonitor from "../Monitor/RealTimeMonitor";
import RealTimeDetectionAnalyzer from "../DetectionAnalyzer/RealTimeDetectionAnalyzer";
import ChamberCameraMain from "../ChamberCamera/ChamberCameraMain";

/**
 * The dashboard is assembled from these panels at runtime. Adding a new panel
 * to the UI means adding one entry here -- the grid, the "add panel" menu and
 * the saved-layout migration all read from this registry, so nothing else needs
 * to change.
 */
export type PanelType =
  | "rheed"
  | "chamberCamera"
  | "analyzer"
  | "monitor"
  | "controller"
  | "storage";

export interface PanelDefinition {
  type: PanelType;
  title: string;
  /** Rendered inside the panel's scrollable body. */
  render: () => ReactNode;
  /** Grid geometry used when the panel is first placed. */
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  /**
   * Panels whose content is a fixed-aspect video surface. The grid gives these
   * a content box that keeps its aspect ratio rather than stretching.
   */
  preserveAspect?: boolean;
  description: string;
}

export const PANEL_REGISTRY: Record<PanelType, PanelDefinition> = {
  rheed: {
    type: "rheed",
    title: "RHEED Camera",
    render: () => <VideoMain />,
    defaultSize: { w: 4, h: 9 },
    minSize: { w: 3, h: 6 },
    preserveAspect: true,
    description: "Live RHEED video with detection overlay",
  },
  chamberCamera: {
    type: "chamberCamera",
    title: "Chamber Camera",
    render: () => <ChamberCameraMain />,
    defaultSize: { w: 4, h: 9 },
    minSize: { w: 3, h: 6 },
    preserveAspect: true,
    description: "Live webcam view inside the chamber",
  },
  analyzer: {
    type: "analyzer",
    title: "Detection Analyzer",
    render: () => <RealTimeDetectionAnalyzer />,
    defaultSize: { w: 4, h: 9 },
    minSize: { w: 3, h: 6 },
    description: "Detections, STFT and integrator traces",
  },
  monitor: {
    type: "monitor",
    title: "Chamber Monitor",
    render: () => <RealTimeMonitor />,
    defaultSize: { w: 4, h: 9 },
    minSize: { w: 3, h: 6 },
    description: "Pressure, temperature, laser and classification",
  },
  controller: {
    type: "controller",
    title: "Server Nodes",
    render: () => <MainController />,
    defaultSize: { w: 8, h: 8 },
    minSize: { w: 4, h: 5 },
    description: "Live node status and stream control",
  },
  storage: {
    type: "storage",
    title: "Storage",
    render: () => <StorageMain />,
    defaultSize: { w: 4, h: 8 },
    minSize: { w: 3, h: 5 },
    description: "Start and stop recording a project",
  },
};

export const PANEL_TYPES = Object.keys(PANEL_REGISTRY) as PanelType[];

export const isPanelType = (value: string): value is PanelType =>
  Object.prototype.hasOwnProperty.call(PANEL_REGISTRY, value);

/** A placed panel. `i` in the grid layout matches `id`. */
export interface PanelInstance {
  id: string;
  type: PanelType;
  /** Overrides the registry title when the user renames the panel. */
  title?: string;
  collapsed?: boolean;
}

export const getPanelTitle = (panel: PanelInstance): string =>
  panel.title ?? PANEL_REGISTRY[panel.type].title;

/**
 * The layout a user sees before they have arranged anything. Mirrors the old
 * hard-coded App.tsx grid so existing users land somewhere familiar.
 *
 * 12 columns at `lg`. The chamber camera is not placed by default -- it is
 * available from the "Add panel" menu -- so operators without a chamber webcam
 * do not get a dead tile.
 */
export const DEFAULT_PANELS: PanelInstance[] = [
  { id: "rheed", type: "rheed" },
  { id: "analyzer", type: "analyzer" },
  { id: "monitor", type: "monitor" },
  { id: "controller", type: "controller" },
  { id: "storage", type: "storage" },
];

export const DEFAULT_LAYOUTS: Record<string, LayoutItem[]> = {
  lg: [
    { i: "rheed", x: 0, y: 0, w: 4, h: 9, minW: 3, minH: 6 },
    { i: "analyzer", x: 4, y: 0, w: 4, h: 9, minW: 3, minH: 6 },
    { i: "monitor", x: 8, y: 0, w: 4, h: 9, minW: 3, minH: 6 },
    { i: "controller", x: 0, y: 9, w: 8, h: 8, minW: 4, minH: 5 },
    { i: "storage", x: 8, y: 9, w: 4, h: 8, minW: 3, minH: 5 },
  ],
  md: [
    { i: "rheed", x: 0, y: 0, w: 5, h: 9, minW: 3, minH: 6 },
    { i: "analyzer", x: 5, y: 0, w: 5, h: 9, minW: 3, minH: 6 },
    { i: "monitor", x: 0, y: 9, w: 5, h: 9, minW: 3, minH: 6 },
    { i: "storage", x: 5, y: 9, w: 5, h: 8, minW: 3, minH: 5 },
    { i: "controller", x: 0, y: 18, w: 10, h: 8, minW: 4, minH: 5 },
  ],
  sm: [
    { i: "rheed", x: 0, y: 0, w: 6, h: 8, minW: 2, minH: 5 },
    { i: "analyzer", x: 0, y: 8, w: 6, h: 8, minW: 2, minH: 5 },
    { i: "monitor", x: 0, y: 16, w: 6, h: 8, minW: 2, minH: 5 },
    { i: "storage", x: 0, y: 24, w: 6, h: 7, minW: 2, minH: 5 },
    { i: "controller", x: 0, y: 31, w: 6, h: 8, minW: 2, minH: 5 },
  ],
  xs: [
    { i: "rheed", x: 0, y: 0, w: 4, h: 7, minW: 2, minH: 4 },
    { i: "analyzer", x: 0, y: 7, w: 4, h: 7, minW: 2, minH: 4 },
    { i: "monitor", x: 0, y: 14, w: 4, h: 7, minW: 2, minH: 4 },
    { i: "storage", x: 0, y: 21, w: 4, h: 7, minW: 2, minH: 4 },
    { i: "controller", x: 0, y: 28, w: 4, h: 8, minW: 2, minH: 4 },
  ],
};

/** Column counts per breakpoint. Shared by the grid and the layout defaults. */
export const GRID_BREAKPOINTS = { lg: 1200, md: 900, sm: 640, xs: 0 };
export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4 };
