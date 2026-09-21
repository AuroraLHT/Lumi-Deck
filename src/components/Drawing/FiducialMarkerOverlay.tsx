import { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";

import { FiducialMarker, MarkerStats } from "../../generated/lumi";

/** No standalone export for the tagged union; derive it from the field that carries it. */
type Shape = FiducialMarker["shape"];
import useFiducialUIStore from "../../stores/fiducialUI";
import useFiducialMarkerControl from "../../hooks/useFiducialMarkerControl";
import useFiducialStatsStore from "../../stores/fiducialStats";

/** Screen pixels a rectangle drag must cover before it counts; see RectangleSelector. */
const MIN_DRAG_PX = 4;

const DEFAULT_CROSS_SIZE = 10;
const DEFAULT_CROSS_THICKNESS = 1;

interface Props {
  markers: FiducialMarker[];
  frameWidth: number;
  frameHeight: number;
}

interface FramePoint {
  x: number;
  y: number;
}

/** The next unused `marker-N` id, so drawing does not require naming up front. */
const nextMarkerId = (markers: FiducialMarker[]): string => {
  let max = 0;
  for (const marker of markers) {
    const match = /^marker-(\d+)$/.exec(marker.marker_id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `marker-${max + 1}`;
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
 * Three shapes, one tool active at a time (`stores/fiducialUI.ts`): a rect is a
 * drag like a detection box, a cross is a single click (its arm length and
 * thickness keep their defaults -- there is no drag gesture that means "half as
 * thick"), a poly is a sequence of clicks closed with a double-click or Enter.
 * Escape backs out of whichever is in progress, same as the RHEED redraw flow.
 */
const FiducialMarkerOverlay = ({ markers, frameWidth, frameHeight }: Props) => {
  const containerRef = useRef<SVGSVGElement>(null);
  const activeTool = useFiducialUIStore((s) => s.activeTool);
  const setActiveTool = useFiducialUIStore((s) => s.setActiveTool);
  const selectedMarkerId = useFiducialUIStore((s) => s.selectedMarkerId);
  const selectMarker = useFiducialUIStore((s) => s.selectMarker);
  const { setMarker, removeMarker } = useFiducialMarkerControl();
  const latestStats = useFiducialStatsStore((s) => s.latest);

  const [dragStart, setDragStart] = useState<FramePoint | null>(null);
  const [dragEnd, setDragEnd] = useState<FramePoint | null>(null);
  const [polyPoints, setPolyPoints] = useState<FramePoint[]>([]);

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
      const id = nextMarkerId(markers);
      setMarker(id, shape).catch((err) => console.error("set_marker failed:", err));
      setActiveTool(null);
      resetDrawing();
    },
    [markers, setMarker, setActiveTool, resetDrawing]
  );

  const finishPoly = useCallback(() => {
    if (polyPoints.length < 3) return;
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
        thickness: DEFAULT_CROSS_THICKNESS,
      });
      return;
    }

    if (activeTool === "rect") {
      setDragStart(point);
      setDragEnd(point);
      return;
    }

    // poly: each click appends a vertex; a click on the first vertex closes it.
    setPolyPoints((points) => {
      if (points.length >= 3) {
        const first = points[0];
        const dx = ((point.x - first.x) / frameWidth) * 100;
        const dy = ((point.y - first.y) / frameHeight) * 100;
        if (Math.hypot(dx, dy) < 1.5) {
          // Closed on the next tick, after state has the full point list.
          setTimeout(finishPoly, 0);
          return points;
        }
      }
      return [...points, point];
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (activeTool !== "rect" || !dragStart) return;
    setDragEnd(toFrame(event));
  };

  const handleMouseUp = () => {
    if (activeTool !== "rect" || !dragStart || !dragEnd) return;
    const screenDx = ((dragEnd.x - dragStart.x) / frameWidth) * (containerRef.current?.getBoundingClientRect().width ?? frameWidth);
    const screenDy = ((dragEnd.y - dragStart.y) / frameHeight) * (containerRef.current?.getBoundingClientRect().height ?? frameHeight);
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

  const drawingStroke = "#3b82f6";

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
      {markers.map((marker) => (
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
          onDelete={() =>
            removeMarker(marker.marker_id).catch((err) =>
              console.error("remove_marker failed:", err)
            )
          }
        />
      ))}

      {activeTool === "rect" && dragStart && dragEnd && (
        <rect
          x={pct(Math.min(dragStart.x, dragEnd.x), frameWidth)}
          y={pct(Math.min(dragStart.y, dragEnd.y), frameHeight)}
          width={pct(Math.abs(dragEnd.x - dragStart.x), frameWidth)}
          height={pct(Math.abs(dragEnd.y - dragStart.y), frameHeight)}
          fill="rgba(59, 130, 246, 0.12)"
          stroke={drawingStroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}

      {activeTool === "poly" && polyPoints.length > 0 && (
        <polyline
          points={polyPoints.map((p) => `${(p.x / frameWidth) * 100},${(p.y / frameHeight) * 100}`).join(" ")}
          fill="none"
          stroke={drawingStroke}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
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
  onDelete: () => void;
}

/**
 * One registered marker, read-only geometry plus its live intensity readout.
 * Selecting it is what the Fiducial Trace panel charts (`stores/fiducialUI.ts`).
 */
const MarkerShape = ({
  marker,
  frameWidth,
  frameHeight,
  isSelected,
  stats,
  onSelect,
  onDelete,
}: MarkerShapeProps) => {
  const stroke = isSelected ? "#f6ad55" : "#48bb78";
  const pctX = (v: number) => `${(v / frameWidth) * 100}%`;
  const pctY = (v: number) => `${(v / frameHeight) * 100}%`;

  let labelX = 0;
  let labelY = 0;
  let geometry: React.ReactNode;

  const { shape } = marker;
  if (shape.kind === "rect") {
    labelX = shape.x;
    labelY = shape.y;
    geometry = (
      <rect
        x={pctX(shape.x)}
        y={pctY(shape.y)}
        width={`${(shape.width / frameWidth) * 100}%`}
        height={`${(shape.height / frameHeight) * 100}%`}
        fill="none"
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
    );
  } else if (shape.kind === "cross") {
    const arm = shape.size ?? DEFAULT_CROSS_SIZE;
    labelX = shape.x;
    labelY = shape.y - arm;
    geometry = (
      <g stroke={stroke} strokeWidth={isSelected ? 2 : 1} vectorEffect="non-scaling-stroke">
        <line x1={pctX(shape.x - arm)} y1={pctY(shape.y)} x2={pctX(shape.x + arm)} y2={pctY(shape.y)} />
        <line x1={pctX(shape.x)} y1={pctY(shape.y - arm)} x2={pctX(shape.x)} y2={pctY(shape.y + arm)} />
      </g>
    );
  } else {
    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);
    labelX = Math.min(...xs);
    labelY = Math.min(...ys);
    geometry = (
      <polygon
        points={shape.points.map((p) => `${(p.x / frameWidth) * 100},${(p.y / frameHeight) * 100}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1}
        vectorEffect="non-scaling-stroke"
      />
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
        fill={stroke}
        fontSize="11px"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {marker.marker_id}
        {stats && stats.mean != null ? ` · ${formatStat(stats.mean)}` : ""}
      </text>
      {isSelected && (
        <text
          x={pctX(labelX)}
          y={pctY(labelY)}
          dy="14"
          fill="white"
          stroke="black"
          strokeWidth="0.4"
          fontSize="10px"
          textAnchor="start"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          [delete]
        </text>
      )}
    </g>
  );
};

export default FiducialMarkerOverlay;
