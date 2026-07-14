import { useCallback, useMemo } from "react";
import { Box, Center, Text, VStack } from "@chakra-ui/react";
import {
  GridLayout,
  Layout,
  LayoutItem,
  useContainerWidth,
  verticalCompactor,
} from "react-grid-layout";

import "react-grid-layout/css/styles.css";

import useDashboardStore from "../../stores/dashboard";
import Panel, { PANEL_DRAG_HANDLE } from "./Panel";
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  PANEL_REGISTRY,
  getPanelTitle,
} from "./panelRegistry";

const ROW_HEIGHT = 34;
const MARGIN: readonly [number, number] = [12, 12];
const CONTAINER_PADDING: readonly [number, number] = [0, 0];

// Panels contain scrollable bodies, form inputs, and a canvas overlay used to
// draw detection boxes. Without this, a drag started inside any of them would
// move the panel instead of interacting with the content.
const DRAG_CANCEL =
  "input,textarea,select,button,canvas,video,a,[role='slider'],.no-drag";

/**
 * Pick the active breakpoint for a measured width.
 *
 * We do this ourselves, and drive the plain `GridLayout`, rather than using
 * `ResponsiveGridLayout`. In react-grid-layout 2.2.x the responsive wrapper keeps
 * its own breakpoint in state, ignores the `breakpoint` prop entirely, and on a
 * viewport change was observed to swap in the new column count while still
 * rendering the *previous* breakpoint's geometry -- so a phone showed 12-column
 * desktop coordinates squeezed into 4 columns, overflowing the page. Selecting
 * the layout here keeps the mapping from width to layout explicit and testable.
 */
const breakpointForWidth = (width: number): string => {
  const ordered = Object.entries(GRID_BREAKPOINTS).sort(
    ([, a], [, b]) => b - a
  );
  const match = ordered.find(([, minWidth]) => width >= minWidth);
  return match ? match[0] : "xs";
};

const DashboardGrid = () => {
  const panels = useDashboardStore((s) => s.panels);
  const layouts = useDashboardStore((s) => s.layouts);
  const locked = useDashboardStore((s) => s.locked);
  const maximizedPanelId = useDashboardStore((s) => s.maximizedPanelId);

  const setLayoutForBreakpoint = useDashboardStore(
    (s) => s.setLayoutForBreakpoint
  );
  const removePanel = useDashboardStore((s) => s.removePanel);
  const toggleCollapsed = useDashboardStore((s) => s.toggleCollapsed);
  const setMaximized = useDashboardStore((s) => s.setMaximized);

  // react-grid-layout v2 has no WidthProvider; the container measures itself.
  const { width, mounted, containerRef } = useContainerWidth();

  const breakpoint = useMemo(() => breakpointForWidth(width), [width]);

  const cols = GRID_COLS[breakpoint as keyof typeof GRID_COLS] ?? 12;

  // Fall back to the widest layout we have, clamped into the current column
  // count, if this breakpoint has never been laid out.
  const layout: LayoutItem[] = useMemo(() => {
    const existing = layouts[breakpoint];
    if (existing?.length) return existing as LayoutItem[];

    const fallback = (layouts.lg ?? layouts.md ?? layouts.sm ?? []) as LayoutItem[];
    return fallback.map((item) => ({
      ...item,
      x: 0,
      w: Math.min(item.w, cols),
    }));
  }, [layouts, breakpoint, cols]);

  const handleLayoutChange = useCallback(
    (next: Layout) => {
      // Only ever writes the breakpoint the user is actually looking at, so
      // rearranging on a laptop cannot corrupt the phone layout.
      setLayoutForBreakpoint(breakpoint, next as LayoutItem[]);
    },
    [setLayoutForBreakpoint, breakpoint]
  );

  const gridConfig = useMemo(
    () => ({
      cols,
      rowHeight: ROW_HEIGHT,
      margin: MARGIN,
      containerPadding: CONTAINER_PADDING,
    }),
    [cols]
  );

  const dragConfig = useMemo(
    () => ({
      enabled: !locked,
      handle: `.${PANEL_DRAG_HANDLE}`,
      cancel: DRAG_CANCEL,
    }),
    [locked]
  );

  const resizeConfig = useMemo(() => ({ enabled: !locked }), [locked]);

  const maximizedPanel = useMemo(
    () => panels.find((p) => p.id === maximizedPanelId) ?? null,
    [panels, maximizedPanelId]
  );

  // A maximized panel leaves the grid entirely and fills the viewport. Rendering
  // it inside the grid and merely making it large would still clip it to the
  // grid's own box.
  if (maximizedPanel) {
    return (
      <Box position="fixed" inset={0} zIndex={20} bg="app.bg" p={3}>
        <Panel
          title={getPanelTitle(maximizedPanel)}
          maximized
          locked
          onMaximize={() => setMaximized(null)}
          style={{ height: "100%" }}
        >
          {PANEL_REGISTRY[maximizedPanel.type].render()}
        </Panel>
      </Box>
    );
  }

  if (panels.length === 0) {
    return (
      <Center h="60vh">
        <VStack spacing={2}>
          <Text fontSize="lg" fontWeight="600" color="text.secondary">
            No panels
          </Text>
          <Text fontSize="sm" color="text.muted">
            Use the + button in the toolbar to build your dashboard.
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    // A plain div, not a Chakra Box: useContainerWidth returns a
    // RefObject<HTMLDivElement | null>, which Chakra's ref prop will not accept.
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      style={{ width: "100%" }}
    >
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={gridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          onLayoutChange={handleLayoutChange}
          // Panels float up into gaps, which keeps the board tidy as things move.
          compactor={verticalCompactor}
        >
          {panels.map((panel) => {
            const definition = PANEL_REGISTRY[panel.type];

            return (
              <div key={panel.id}>
                <Panel
                  title={getPanelTitle(panel)}
                  collapsed={panel.collapsed}
                  locked={locked}
                  onCollapse={() => toggleCollapsed(panel.id)}
                  onMaximize={() => setMaximized(panel.id)}
                  onRemove={() => removePanel(panel.id)}
                  style={{ height: "100%" }}
                >
                  {definition.render()}
                </Panel>
              </div>
            );
          })}
        </GridLayout>
      )}
    </div>
  );
};

export default DashboardGrid;
