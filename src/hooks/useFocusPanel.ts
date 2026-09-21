import { useCallback } from "react";

import useDashboardStore from "../stores/dashboard";
import { PanelType } from "../components/Dashboard/panelRegistry";

/**
 * Jumps the dashboard to a panel of the given type, placing it first if it is
 * not already on the board.
 *
 * Built for the Chamber Camera panel's "View calibration trace" button: a
 * marker is drawn on one panel and its trace lives on another, and asking the
 * operator to go find (or re-add) the trace panel themselves is the "hop
 * around" this exists to avoid. Only ever targets the *first* panel of a type
 * -- fiducial markers have one shared trace view, not one per browser tab.
 */
const useFocusPanel = () => {
  const panels = useDashboardStore((s) => s.panels);
  const addPanel = useDashboardStore((s) => s.addPanel);

  return useCallback(
    (type: PanelType) => {
      const existing = panels.find((p) => p.type === type);
      const id = existing ? existing.id : addPanel(type);
      // A freshly added panel has not painted yet; a frame gives the grid
      // layout pass somewhere to find before `scrollIntoView` runs on it.
      requestAnimationFrame(() => {
        document
          .getElementById(`panel-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [panels, addPanel]
  );
};

export default useFocusPanel;
