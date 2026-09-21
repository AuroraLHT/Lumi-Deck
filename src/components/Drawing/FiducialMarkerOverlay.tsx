import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

import { FiducialMarker, MarkerStats } from "../../generated/lumi";

/** No standalone export for the tagged union; derive it from the field that carries it. */
type Shape = FiducialMarker["shape"];
import useFiducialUIStore from "../../stores/fiducialUI";
import useFiducialMarkerControl from "../../hooks/useFiducialMarkerControl";
import useFiducialStatsStore from "../../stores/fiducialStats";

/** Screen pixels a rect/circle drag must cover before it counts; see RectangleSelector. */
const MIN_DRAG_PX = 4;

const DEFAULT_CROSS_SIZE = 10;
//: Half-width of the square patch `chamber.fiducial` measures around a cross,
//: in pixels -- 1 is its own backend default (a 3x3 patch).
const DEFAULT_CROSS_SAMPLE_RADIUS = 1;

/** A dark outline under the colour, so a marker reads against video of any
 * brightness -- a thin cyan or orange line alone washes out over bright metal
 * and blown-out highlights. */
const HALO_COLOR = "rgba(0, 0, 0, 0.85)";
const HALO_EXTRA_WIDTH = 2;

interface Props {
  markers: FiducialMarker[];
  frameWidth: number;
  frameHeight: number;
}

interface FramePoint {
  x: number;
  y: number;
}

/** The highest `marker-N` suffix among these ids, or 0 if none match. */
const maxMarkerSuffix = (ids: Iterable<string>): number => {
  let max = 0;
  for (const id of ids) {
    const match = /^marker-(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
};

const formatStat = (value: number | null | undefined): string =>
  value == null ? "—" : value.toFixed(1);

/**
 * Drag-to-draw overlay for `chamber.fiducial` markers on the Chamber Camera
 * feed, plus read-only rendering of the markers already registered on the node.
 *
 * Modeled on `RectangleSelector`/`RegisteredBoxRect`: percent-of-container SVG
 * coordinates scaled against the frame size, same reason -- the displayed video
 * is whatever CSS size the panel gives it, but marker geometry is always in
 * camera-frame pixels, the space the backend measures pixels in.
 *
 * Four shapes, one tool active at a time (`stores/fiducialUI.ts`): a rect or a
 * circle is a drag (centre-to-edge for the circle), a cross is a single click
 * (its display size and sampling patch keep their defaults -- there is no drag
 * gesture that means "measure a bigger patch"), a poly is a sequence of clicks
 * closed by clicking the first vertex, double-clicking, or Enter. Escape backs
 * out of whichever is in progress, same as the RHEED redraw flow.
 */
const FiducialMarkerOverlay = ({ markers, frameWidth, frameHeight }: Props) => {
  const containerRef = useRef<SVGSVGElement>(null);
  const activeTool = useFiducialUIStore((s) => s.activeTool);
  const setActiveTool = useFiducialUIStore((s) => s.setActiveTool);
  const selectedMarkerId = useFiducialUIStore((s) => s.selectedMarkerId);
  const selectMarker = useFiducialUIStore((s) => s.selectMarker);
  const markersHidden = useFiducialUIStore((s) => s.markersHidden);
  const { setMarker } = useFiducialMarkerControl();
  const latestStats = useFiducialStatsStore((s) => s.latest);

  const [dragStart, setDragStart] = useState<FramePoint | null>(null);
  const [dragEnd, setDragEnd] = useState<FramePoint | null>(null);
  const [polyPoints, setPolyPoints] = useState<FramePoint[]>([]);

  // A double-click to close a polygon dispatches two mousedowns; both land
  // inside the same event batch, before either's `setPolyPoints` update (or
  // the `setTimeout` it schedules) has been observed by the other, so both
  // detect "click landed on the closing point" and each schedules its own
  // `finishPoly`. Without a synchronous guard, that commits the same
  // geometry twice (three times counting the native `dblclick` handler,
  // which is reached the same way). A ref is read/written immediately,
  // unlike state, so it closes the window regardless of how many of the
  // redundant triggers fire before any of them actually runs.
  const finishingRef = useRef(false);
  useEffect(() => {
    if (activeTool === "poly") finishingRef.current = false;
  }, [activeTool]);

  // The next `marker-N` suffix to hand out, tracked locally rather than
  // derived from `markers` at commit time. `markers` reflects the *backend's*
  // registry, which only catches up after a round trip (`set_marker`) and
  // then the heartbeat -- drawing a second marker before either has landed
  // used to compute the same "next" id as the first and silently overwrite
  // it. A local counter that only ever advances is immune to that: it starts
  // at whatever the backend already has and gets bumped on every commit this
  // browser makes, with no need to wait on a response to know the next one.
  const nextIdRef = useRef(0);
  useEffect(() => {
    const known = maxMarkerSuffix(markers.map((m) => m.marker_id));
    if (known > nextIdRef.current) nextIdRef.current = known;
  }, [markers]);

  const hasFrame = frameWidth > 0 && frameHeight > 0;

  const toFrame = useCallback(
    (event: MouseEvent | React.MouseEvent): FramePoint => {
      const container = containerRef.current;
      if (!container || !hasFrame) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      const fracX = (event.clientX - rect.left) / rect.width;
      const fracY = (event.clientY - rect.top) / rect.height;
      return { x: fracX * frameWidth, y: fracY * frameHeight };
    },
    [frameWidth, frameHeight, hasFrame]
  );

  const pct = (value: number, extent: number) => `${(value / extent) * 100}%`;

  const resetDrawing = useCallback(() => {
    setDragStart(null);
    setDragEnd(null);
    setPolyPoints([]);
  }, []);

  const cancelTool = useCallback(() => {
    setActiveTool(null);
    resetDrawing();
  }, [setActiveTool, resetDrawing]);

  // Escape backs out of drawing, the same relief valve RectangleSelector gives
  // the RHEED redraw flow -- without it the only way out of an armed tool is to
  // finish drawing something.
  useEffect(() => {
    if (!activeTool) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelTool();
      if (event.key === "Enter" && activeTool === "poly") finishPoly();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, polyPoints]);

  const commit = useCallback(
    (shape: Shape) => {
      nextIdRef.current += 1;
      const id = `marker-${nextIdRef.current}`;
      setMarker(id, shape).catch((err) => console.error("set_marker failed:", err));
      setActiveTool(null);
      resetDrawing();
    },
    [setMarker, setActiveTool, resetDrawing]
  );

  const finishPoly = useCallback(() => {
    if (finishingRef.current || polyPoints.length < 3) return;
    finishingRef.current = true;
    commit({ kind: "poly", points: polyPoints.map((p) => ({ x: p.x, y: p.y })) });
  }, [polyPoints, commit]);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!activeTool || !hasFrame) return;
    const point = toFrame(event);

    if (activeTool === "cross") {
      commit({
        kind: "cross",
        x: point.x,
        y: point.y,
        size: DEFAULT_CROSS_SIZE,
        sample_radius: DEFAULT_CROSS_SAMPLE_RADIUS,
      });
      return;
    }

    if (activeTool === "rect" || activeTool === "circle") {
      setDragStart(point);
      setDragEnd(point);
      return;
    }

    // poly: each click appends a vertex. Closes on a click near the first
    // vertex, or -- since double-click is also a supported way to finish --
    // on a click landing right on top of the *last* one: that is the second
    // mousedown of the double-click, and appending it too would leave a
    // spurious near-duplicate vertex sitting on the closing point. This is a
    // proximity check, not `event.detail`: Chromium's synthetic click count
    // for scripted/automated input was seen to misfire even for clicks well
    // apart in both time and position, silently dropping ordinary vertices.
    setPolyPoints((points) => {
      const near = (target: FramePoint) => {
        const dx = ((point.x - target.x) / frameWidth) * 100;
        const dy = ((point.y - target.y) / frameHeight) * 100;
        return Math.hypot(dx, dy) < 1.5;
      };
      if (points.length >= 1 && near(points[points.length - 1])) {
        if (points.length >= 3) setTimeout(finishPoly, 0);
        return points;
      }
      if (points.length >= 3 && near(points[0])) {
        // Closed on the next tick, after state has the full point list.
        setTimeout(finishPoly, 0);
        return points;
      }
      return [...points, point];
    });
  };

  const isDragTool = activeTool === "rect" || activeTool === "circle";

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragTool || !dragStart) return;
    setDragEnd(toFrame(event));
  };

  const handleMouseUp = () => {
    if (!isDragTool || !dragStart || !dragEnd) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    const screenDx = ((dragEnd.x - dragStart.x) / frameWidth) * (containerRect?.width ?? frameWidth);
    const screenDy = ((dragEnd.y - dragStart.y) / frameHeight) * (containerRect?.height ?? frameHeight);

    if (activeTool === "circle") {
      // A circle has one degree of freedom (radius), so total travel is the
      // right measure -- unlike the rect's two independent axes below.
      if (Math.hypot(screenDx, screenDy) < MIN_DRAG_PX) {
        setDragStart(null);
        setDragEnd(null);
        return;
      }
      commit({
        kind: "circle",
        x: dragStart.x,
        y: dragStart.y,
        radius: Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y),
      });
      return;
    }

    if (Math.abs(screenDx) < MIN_DRAG_PX || Math.abs(screenDy) < MIN_DRAG_PX) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    commit({
      kind: "rect",
      x,
      y,
      width: Math.abs(dragEnd.x - dragStart.x),
      height: Math.abs(dragEnd.y - dragStart.y),
    });
  };

  const handleDoubleClick = () => {
    if (activeTool === "poly") finishPoly();
  };

  if (!hasFrame) return null;

  const drawingStroke = "#60a5fa";

  return (
    <Box
      as="svg"
      ref={containerRef}
      position="absolute"
      top="0"
      left="0"
      width="100%"
      height="100%"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      cursor={activeTool ? "crosshair" : "default"}
      pointerEvents="all"
    >
      {!markersHidden &&
        markers.map((marker) => (
          <MarkerShape
            key={marker.marker_id}
            marker={marker}
            frameWidth={frameWidth}
            frameHeight={frameHeight}
            isSelected={marker.marker_id === selectedMarkerId}
            stats={latestStats[marker.marker_id]}
            onSelect={() =>
              selectMarker(marker.marker_id === selectedMarkerId ? null : marker.marker_id)
            }
          />
        ))}

      {activeTool === "rect" && dragStart && dragEnd && (
        <>
          <rect
            x={pct(Math.min(dragStart.x, dragEnd.x), frameWidth)}
            y={pct(Math.min(dragStart.y, dragEnd.y), frameHeight)}
            width={pct(Math.abs(dragEnd.x - dragStart.x), frameWidth)}
            height={pct(Math.abs(dragEnd.y - dragStart.y), frameHeight)}
            fill="none"
            stroke={HALO_COLOR}
            strokeWidth={2 + HALO_EXTRA_WIDTH}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <rect
            x={pct(Math.min(dragStart.x, dragEnd.x), frameWidth)}
            y={pct(Math.min(dragStart.y, dragEnd.y), frameHeight)}
            width={pct(Math.abs(dragEnd.x - dragStart.x), frameWidth)}
            height={pct(Math.abs(dragEnd.y - dragStart.y), frameHeight)}
            fill="rgba(96, 165, 250, 0.15)"
            stroke={drawingStroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </>
      )}

      {activeTool === "circle" && dragStart && dragEnd && (
        <>
          <ellipse
            cx={pct(dragStart.x, frameWidth)}
            cy={pct(dragStart.y, frameHeight)}
            rx={pct(Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y), frameWidth)}
            ry={pct(Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y), frameHeight)}
            fill="none"
            stroke={HALO_COLOR}
            strokeWidth={2 + HALO_EXTRA_WIDTH}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <ellipse
            cx={pct(dragStart.x, frameWidth)}
            cy={pct(dragStart.y, frameHeight)}
            rx={pct(Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y), frameWidth)}
            ry={pct(Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y), frameHeight)}
            fill="rgba(96, 165, 250, 0.15)"
            stroke={drawingStroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </>
      )}

      {activeTool === "poly" && polyPoints.length > 0 && (
        <>
          <polyline
            points={polyPoints.map((p) => `${(p.x / frameWidth) * 100},${(p.y / frameHeight) * 100}`).join(" ")}
            fill="none"
            stroke={HALO_COLOR}
            strokeWidth={2 + HALO_EXTRA_WIDTH}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <polyline
            points={polyPoints.map((p) => `${(p.x / frameWidth) * 100},${(p.y / frameHeight) * 100}`).join(" ")}
            fill="none"
            stroke={drawingStroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </>
      )}
    </Box>
  );
};

interface MarkerShapeProps {
  marker: FiducialMarker;
  frameWidth: number;
  frameHeight: number;
  isSelected: boolean;
  stats: MarkerStats | undefined;
  onSelect: () => void;
}

/**
 * One registered marker, read-only geometry plus its live intensity readout.
 *
 * Every stroke is drawn twice -- a wider dark halo, then the colour on top --
 * so the marker stays legible over both blown-out highlights and dark metal.
 * Removing a marker is the toolbar chip's job (`FiducialToolbar`), not this
 * overlay: an inline "[delete]" label here duplicated that control and sat on
 * top of the video where it was easy to hit by accident.
 */
const MarkerShape = ({
  marker,
  frameWidth,
  frameHeight,
  isSelected,
  stats,
  onSelect,
}: MarkerShapeProps) => {
  const stroke = isSelected ? "#fb923c" : "#22d3ee";
  const strokeWidth = isSelected ? 2 : 1.5;
  const pctX = (v: number) => `${(v / frameWidth) * 100}%`;
  const pctY = (v: number) => `${(v / frameHeight) * 100}%`;

  let labelX = 0;
  let labelY = 0;
  // Rect/cross anchor at a corner or tip, so the label reads naturally
  // starting there; a poly's label sits at the centroid, so centering it
  // keeps it from drifting off to one side of the shape.
  let labelAnchor: "start" | "middle" = "start";
  let geometry: React.ReactNode;

  const { shape } = marker;
  if (shape.kind === "rect") {
    labelX = shape.x;
    labelY = shape.y;
    const rectProps = {
      x: pctX(shape.x),
      y: pctY(shape.y),
      width: `${(shape.width / frameWidth) * 100}%`,
      height: `${(shape.height / frameHeight) * 100}%`,
      fill: "none",
      vectorEffect: "non-scaling-stroke" as const,
    };
    geometry = (
      <>
        <rect {...rectProps} stroke={HALO_COLOR} strokeWidth={strokeWidth + HALO_EXTRA_WIDTH} />
        <rect {...rectProps} stroke={stroke} strokeWidth={strokeWidth} />
      </>
    );
  } else if (shape.kind === "cross") {
    const arm = shape.size ?? DEFAULT_CROSS_SIZE;
    labelX = shape.x;
    labelY = shape.y - arm;
    const lines = (
      <>
        <line x1={pctX(shape.x - arm)} y1={pctY(shape.y)} x2={pctX(shape.x + arm)} y2={pctY(shape.y)} />
        <line x1={pctX(shape.x)} y1={pctY(shape.y - arm)} x2={pctX(shape.x)} y2={pctY(shape.y + arm)} />
      </>
    );
    geometry = (
      <>
        <g stroke={HALO_COLOR} strokeWidth={strokeWidth + HALO_EXTRA_WIDTH} vectorEffect="non-scaling-stroke">
          {lines}
        </g>
        <g stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
          {lines}
        </g>
      </>
    );
  } else if (shape.kind === "circle") {
    labelX = shape.x;
    labelY = shape.y - shape.radius;
    const ellipseProps = {
      cx: pctX(shape.x),
      cy: pctY(shape.y),
      rx: `${(shape.radius / frameWidth) * 100}%`,
      ry: `${(shape.radius / frameHeight) * 100}%`,
      fill: "none",
      vectorEffect: "non-scaling-stroke" as const,
    };
    geometry = (
      <>
        <ellipse {...ellipseProps} stroke={HALO_COLOR} strokeWidth={strokeWidth + HALO_EXTRA_WIDTH} />
        <ellipse {...ellipseProps} stroke={stroke} strokeWidth={strokeWidth} />
      </>
    );
  } else {
    // The bounding-box corner (min x, min y) is not necessarily anywhere near
    // the polygon itself -- for an elongated or rotated shape it can sit well
    // outside it. The centroid always lands inside (for a convex marker) or at
    // least close to the body, which is what "the label is near the marker"
    // needs.
    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);
    labelX = xs.reduce((a, b) => a + b, 0) / xs.length;
    labelY = ys.reduce((a, b) => a + b, 0) / ys.length;
    labelAnchor = "middle";
    const points = shape.points.map((p) => `${(p.x / frameWidth) * 100},${(p.y / frameHeight) * 100}`).join(" ");
    geometry = (
      <>
        <polygon points={points} fill="none" stroke={HALO_COLOR} strokeWidth={strokeWidth + HALO_EXTRA_WIDTH} vectorEffect="non-scaling-stroke" />
        <polygon points={points} fill="none" stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      </>
    );
  }

  return (
    <g
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      style={{ cursor: "pointer" }}
    >
      {geometry}
      <text
        x={pctX(labelX)}
        y={pctY(labelY)}
        dy="-4"
        textAnchor={labelAnchor}
        fill={stroke}
        stroke={HALO_COLOR}
        strokeWidth="3"
        paintOrder="stroke"
        fontSize="11px"
        fontWeight="600"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {marker.marker_id}
        {stats && stats.mean != null ? ` · ${formatStat(stats.mean)}` : ""}
      </text>
    </g>
  );
};

export default FiducialMarkerOverlay;
