import { create } from "zustand";
import { LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { v4 as uuidv4 } from "uuid";

import {
  DEFAULT_LAYOUTS,
  DEFAULT_PANELS,
  PANEL_REGISTRY,
  PanelInstance,
  PanelType,
  isPanelType,
} from "../components/Dashboard/panelRegistry";

/**
 * Shape of the object persisted to the backend under `dashboard`.
 * Versioned so a future layout change can migrate old saves instead of
 * throwing the user's arrangement away.
 */
export interface DashboardSettings {
  version: number;
  panels: PanelInstance[];
  layouts: ResponsiveLayouts;
}

export const DASHBOARD_VERSION = 1;

interface DashboardState {
  panels: PanelInstance[];
  layouts: ResponsiveLayouts;

  /** True once settings have been fetched, so we don't save defaults over a real save. */
  hydrated: boolean;
  /** Locked layouts cannot be dragged or resized -- guards against nudging a panel mid-run. */
  locked: boolean;

  /**
   * Replace the layout for a single breakpoint. Scoped deliberately: a whole-object
   * setter let a rearrangement on a laptop overwrite the phone layout.
   */
  setLayoutForBreakpoint: (breakpoint: string, layout: LayoutItem[]) => void;
  addPanel: (type: PanelType) => void;
  removePanel: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  setLocked: (locked: boolean) => void;
  resetToDefaults: () => void;

  hydrate: (settings: DashboardSettings | null) => void;
  toSettings: () => DashboardSettings;
}

/** Compare only the fields that describe where a panel sits. */
const isSameLayout = (a: LayoutItem[], b: LayoutItem[]): boolean =>
  a.length === b.length &&
  a.every((item, index) => {
    const other = b[index];
    return (
      other &&
      item.i === other.i &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h
    );
  });

/** Reject anything that isn't a layout we can actually render. */
const sanitize = (settings: DashboardSettings): DashboardSettings => {
  const panels = settings.panels.filter((p) => isPanelType(p.type));
  const ids = new Set(panels.map((p) => p.id));

  // Drop layout entries for panels that no longer exist (e.g. a panel type was
  // removed from the registry between releases), otherwise react-grid-layout
  // renders phantom tiles.
  const layouts: Record<string, LayoutItem[]> = {};
  for (const [breakpoint, items] of Object.entries(settings.layouts ?? {})) {
    layouts[breakpoint] = ((items ?? []) as LayoutItem[]).filter((item) =>
      ids.has(item.i)
    );
  }

  return { version: DASHBOARD_VERSION, panels, layouts };
};

/** Place a newly added panel at the bottom of every breakpoint's layout. */
const appendToLayouts = (
  layouts: ResponsiveLayouts,
  id: string,
  type: PanelType
): ResponsiveLayouts => {
  const { defaultSize, minSize } = PANEL_REGISTRY[type];
  const next: Record<string, LayoutItem[]> = {};

  for (const breakpoint of Object.keys(DEFAULT_LAYOUTS)) {
    const items = [...(layouts[breakpoint] ?? [])];
    const bottom = items.reduce(
      (max: number, item: LayoutItem) => Math.max(max, item.y + item.h),
      0
    );

    next[breakpoint] = [
      ...items,
      {
        i: id,
        x: 0,
        y: bottom,
        w: defaultSize.w,
        h: defaultSize.h,
        minW: minSize.w,
        minH: minSize.h,
      },
    ];
  }

  return next;
};

const useDashboardStore = create<DashboardState>((set, get) => ({
  panels: DEFAULT_PANELS,
  layouts: DEFAULT_LAYOUTS,
  hydrated: false,
  locked: false,

  setLayoutForBreakpoint: (breakpoint, layout) =>
    set((state) => {
      const current = state.layouts[breakpoint];

      // react-grid-layout fires onLayoutChange on mount and on every render pass,
      // not only after a drag. Without this equality check each of those would
      // produce a new object, re-trigger the debounced save, and write the same
      // layout to the server in a loop.
      if (current && isSameLayout(current as LayoutItem[], layout)) {
        return state;
      }

      return { layouts: { ...state.layouts, [breakpoint]: layout } };
    }),

  addPanel: (type) => {
    const id = `${type}-${uuidv4().slice(0, 8)}`;
    set((state) => ({
      panels: [...state.panels, { id, type }],
      layouts: appendToLayouts(state.layouts, id, type),
    }));
  },

  removePanel: (id) =>
    set((state) => {
      const layouts: Record<string, LayoutItem[]> = {};
      for (const [breakpoint, items] of Object.entries(state.layouts)) {
        layouts[breakpoint] = (items ?? []).filter(
          (item: LayoutItem) => item.i !== id
        );
      }
      return {
        panels: state.panels.filter((p) => p.id !== id),
        layouts,
      };
    }),

  toggleCollapsed: (id) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, collapsed: !p.collapsed } : p
      ),
    })),

  setLocked: (locked) => set({ locked }),

  resetToDefaults: () =>
    set({
      panels: DEFAULT_PANELS,
      layouts: DEFAULT_LAYOUTS,
    }),

  hydrate: (settings) => {
    if (!settings || !settings.panels?.length) {
      // No saved dashboard (new user, or they reset it): keep the defaults but
      // mark hydrated so subsequent edits persist.
      set({ hydrated: true });
      return;
    }

    const clean = sanitize(settings);
    set({
      panels: clean.panels,
      layouts: clean.layouts,
      hydrated: true,
    });
  },

  toSettings: () => ({
    version: DASHBOARD_VERSION,
    panels: get().panels,
    layouts: get().layouts,
  }),
}));

export default useDashboardStore;
