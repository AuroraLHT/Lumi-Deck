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

/**
 * The highest numbered suffix among these ids, or 0 if none match. Reads the
 * short `m12` ids drawn here as well as the older `marker-12` ones still
 * registered on nodes, so a rename never hands out a number that is already on
 * screen under the old spelling.
 */
const maxMarkerSuffix = (ids: Iterable<string>): number => {
  let max = 0;
  for (const id of ids) {
    const match = /^(?:m|marker-)(\d+)$/.exec(id);
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
 * Marker geometry is in camera-frame pixels -- the space the backend measures
 * in -- so the overlay simply adopts that as its own coordinate system:
 * `viewBox="0 0 frameWidth frameHeight"` with the default "meet" fit, which is
 * the same uniform-scale-and-centre rule the canvas underneath applies via
 * `objectFit: contain`. The SVG's user space therefore lands exactly on the
 * displayed image at any panel size, and every shape below can be written in
 * plain frame coordinates: circles stay round, nothing skews when the panel is
 * reshaped, and there is no per-shape aspect correction to get wrong.
 *
 * Two things do *not* want to scale with the video and so are handled
 * explicitly: strokes (`vector-effect="non-scaling-stroke"`) and labels (a
 * `scale(labelScale)` group, `labelScale` being the inverse of the measured
 * fit scale, which keeps them at a constant size in device pixels).
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
  /** Cursor position in frame pixels, rounded, while it is over the video. */
  const [hover, setHover] = useState<FramePoint | null>(null);

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

  // The next `mN` suffix to hand out, tracked locally rather than
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

  // Displayed pixels per frame pixel: how far the viewBox's "meet" fit had to
  // shrink (or grow) the frame to fit the panel. Only labels and the
  // minimum-drag threshold care -- everything else is happier in frame units.
  const [displayScale, setDisplayScale] = useState(1);
  useEffect(() => {
    const svg = containerRef.current;
    if (!svg || !hasFrame) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setDisplayScale(Math.min(rect.width / frameWidth, rect.height / frameHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [frameWidth, frameHeight, hasFrame]);

  // Screen -> frame via the SVG's own screen CTM rather than hand-rolled
  // arithmetic on the bounding rect: the CTM already encodes the viewBox fit,
  // letterbox offset included, so this stays correct whatever shape the panel
  // is dragged into.
  const toFrame = useCallback(
    (event: MouseEvent | React.MouseEvent): FramePoint | null => {
      const svg = containerRef.current;
      if (!svg || !hasFrame) return null;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
      return { x: point.x, y: point.y };
    },
    [hasFrame]
  );

  /** Whether a point landed on the video itself and not in a letterbox bar. */
  const inFrame = (point: FramePoint) =>
    point.x >= 0 && point.x <= frameWidth && point.y >= 0 && point.y <= frameHeight;

  const clampToFrame = (point: FramePoint): FramePoint => ({
    x: Math.min(Math.max(point.x, 0), frameWidth),
    y: Math.min(Math.max(point.y, 0), frameHeight),
  });

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
      // Short on purpose: the id is drawn on the video next to the live
      // readout, and repeated in every toolbar chip, where "marker-" was six
      // characters of nothing per marker.
      const id = `m${nextIdRef.current}`;
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
    // The overlay spans the whole panel, but the video only spans part of it
    // when the two aspects differ; a click on a letterbox bar is not a click
    // on the camera, so it starts nothing.
    if (!point || !inFrame(point)) return;

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
    const point = toFrame(event);

    // The readout is in whole frame pixels, so only a move that crosses a
    // pixel boundary is worth a render -- at 60Hz over a scaled-down frame,
    // most moves do not, and each one would otherwise redraw every marker.
    const next =
      point && inFrame(point) ? { x: Math.round(point.x), y: Math.round(point.y) } : null;
    setHover((prev) =>
      prev === next || (prev && next && prev.x === next.x && prev.y === next.y) ? prev : next
    );

    if (!isDragTool || !dragStart) return;
    // Dragging past the edge of the video pins the shape to the edge rather
    // than committing geometry the camera has no pixels for.
    if (point) setDragEnd(clampToFrame(point));
  };

  const handleMouseUp = () => {
    if (!isDragTool || !dragStart || !dragEnd) return;
    const screenDx = (dragEnd.x - dragStart.x) * displayScale;
    const screenDy = (dragEnd.y - dragStart.y) * displayScale;

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
  const labelScale = displayScale > 0 ? 1 / displayScale : 1;

  return (
    <Box
      as="svg"
      ref={containerRef}
      position="absolute"
      top="0"
      left="0"
      width="100%"
      height="100%"
      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setHover(null)}
      onDoubleClick={handleDoubleClick}
      cursor={activeTool ? "crosshair" : "default"}
      pointerEvents="all"
    >
      {!markersHidden &&
        markers.map((marker) => (
          <MarkerShape
            key={marker.marker_id}
            marker={marker}
            labelScale={labelScale}
            isSelected={marker.marker_id === selectedMarkerId}
            stats={latestStats[marker.marker_id]}
            onSelect={() =>
              selectMarker(marker.marker_id === selectedMarkerId ? null : marker.marker_id)
            }
          />
        ))}

      {activeTool === "rect" && dragStart && dragEnd && (
        <g pointerEvents="none">
          {[
            { stroke: HALO_COLOR, strokeWidth: 2 + HALO_EXTRA_WIDTH, fill: "none" },
            { stroke: drawingStroke, strokeWidth: 2, fill: "rgba(96, 165, 250, 0.15)" },
          ].map((paint, index) => (
            <rect
              key={index}
              x={Math.min(dragStart.x, dragEnd.x)}
              y={Math.min(dragStart.y, dragEnd.y)}
              width={Math.abs(dragEnd.x - dragStart.x)}
              height={Math.abs(dragEnd.y - dragStart.y)}
              vectorEffect="non-scaling-stroke"
              {...paint}
            />
          ))}
        </g>
      )}

      {activeTool === "circle" && dragStart && dragEnd && (
        <g pointerEvents="none">
          {[
            { stroke: HALO_COLOR, strokeWidth: 2 + HALO_EXTRA_WIDTH, fill: "none" },
            { stroke: drawingStroke, strokeWidth: 2, fill: "rgba(96, 165, 250, 0.15)" },
          ].map((paint, index) => (
            <circle
              key={index}
              cx={dragStart.x}
              cy={dragStart.y}
              r={Math.hypot(dragEnd.x - dragStart.x, dragEnd.y - dragStart.y)}
              vectorEffect="non-scaling-stroke"
              {...paint}
            />
          ))}
        </g>
      )}

      {activeTool === "poly" && polyPoints.length > 0 && (
        <g pointerEvents="none">
          {[
            { stroke: HALO_COLOR, strokeWidth: 2 + HALO_EXTRA_WIDTH },
            { stroke: drawingStroke, strokeWidth: 2 },
          ].map((paint, index) => (
            <polyline
              key={index}
              points={polyPoints.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              vectorEffect="non-scaling-stroke"
              {...paint}
            />
          ))}
        </g>
      )}

      {/* Where the cursor is in the camera's own pixels -- the coordinates the
        * backend stores markers in and reports them back in, so a number read
        * off a marker's geometry can be found on the video by eye. Counter-
        * scaled like the marker labels, and flipped away from the right and
        * top edges so the readout never runs off the image it describes. */}
      {hover && (
        <g
          transform={`translate(${hover.x} ${hover.y}) scale(${labelScale})`}
          pointerEvents="none"
        >
          <text
            x={hover.x > frameWidth * 0.8 ? -8 : 8}
            y={hover.y < frameHeight * 0.12 ? 16 : -8}
            textAnchor={hover.x > frameWidth * 0.8 ? "end" : "start"}
            fill="#e2e8f0"
            stroke={HALO_COLOR}
            strokeWidth="3"
            paintOrder="stroke"
            fontSize="11"
            fontWeight="600"
            style={{ userSelect: "none" }}
          >
            {hover.x}, {hover.y}
          </text>
        </g>
      )}
    </Box>
  );
};

interface MarkerShapeProps {
  marker: FiducialMarker;
  /** Frame pixels per displayed pixel -- the label group's counter-scale. */
  labelScale: number;
  isSelected: boolean;
  stats: MarkerStats | undefined;
  onSelect: () => void;
}

/**
 * One registered marker, read-only geometry plus its live intensity readout.
 * Drawn in frame coordinates -- the overlay's viewBox is the frame, so the
 * numbers the backend stores go straight onto the video with no conversion.
 *
 * Every stroke is drawn twice -- a wider dark halo, then the colour on top --
 * so the marker stays legible over both blown-out highlights and dark metal.
 * Removing a marker is the toolbar chip's job (`FiducialToolbar`), not this
 * overlay: an inline "[delete]" label here duplicated that control and sat on
 * top of the video where it was easy to hit by accident.
 */
const MarkerShape = ({
  marker,
  labelScale,
  isSelected,
  stats,
  onSelect,
}: MarkerShapeProps) => {
  const stroke = isSelected ? "#fb923c" : "#22d3ee";
  const strokeWidth = isSelected ? 2 : 1.5;

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
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
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
        <line x1={shape.x - arm} y1={shape.y} x2={shape.x + arm} y2={shape.y} />
        <line x1={shape.x} y1={shape.y - arm} x2={shape.x} y2={shape.y + arm} />
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
    const circleProps = {
      cx: shape.x,
      cy: shape.y,
      r: shape.radius,
      fill: "none",
      vectorEffect: "non-scaling-stroke" as const,
    };
    geometry = (
      <>
        <circle {...circleProps} stroke={HALO_COLOR} strokeWidth={strokeWidth + HALO_EXTRA_WIDTH} />
        <circle {...circleProps} stroke={stroke} strokeWidth={strokeWidth} />
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
    const points = shape.points.map((p) => `${p.x},${p.y}`).join(" ");
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
      {/* Anchored in frame coordinates but counter-scaled back to device
        * pixels, so the readout is the same size whether the panel is a thumb
        * or half the dashboard -- text scaled with the video would be
        * unreadable at one end and overbearing at the other. */}
      <g
        transform={`translate(${labelX} ${labelY}) scale(${labelScale})`}
        pointerEvents="none"
      >
        <text
          dy="-4"
          textAnchor={labelAnchor}
          fill={stroke}
          stroke={HALO_COLOR}
          strokeWidth="3"
          paintOrder="stroke"
          fontSize="11"
          fontWeight="600"
          style={{ userSelect: "none" }}
        >
          {marker.marker_id}
          {stats && stats.mean != null ? ` · ${formatStat(stats.mean)}` : ""}
        </text>
      </g>
    </g>
  );
};

export default FiducialMarkerOverlay;
