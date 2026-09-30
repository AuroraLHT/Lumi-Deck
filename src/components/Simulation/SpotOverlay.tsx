import { useId } from "react";

import { RheedSimMeta, RheedSpot } from "../../generated/lumi";
import { SpotKind } from "../../stores/rheedSim";
import { useKindColors } from "./spotKinds";

const HALO = "rgba(0, 0, 0, 0.65)";

interface Placed {
  x: number;
  y: number;
  anchor: "start" | "end";
}

/**
 * Where each label goes, or nowhere. Rods first, then the rest in list order;
 * a label tries the upper right of its ring, then the upper left, then the
 * lower sides, and is dropped if every spot collides with one already placed
 * or leaves the screen. A dropped label is still in the table and the tooltip.
 * Streak maxima are not labelled: they sit on a rod's streak, next to its label.
 */
const placeLabels = (spots: RheedSpot[], w: number, h: number, r: number, font: number) => {
  const placed = new Map<RheedSpot, Placed>();
  const boxes: [number, number, number, number][] = [];
  const charW = font * 0.62;
  const overlaps = (b: [number, number, number, number]) =>
    boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);

  const order = [...spots.filter((s) => s.kind === "rod"), ...spots.filter((s) => s.kind !== "rod")];
  // Every ring is an obstacle, so no label covers another spot.
  for (const s of spots) boxes.push([s.x_px - r, s.y_px - r, s.x_px + r, s.y_px + r]);

  for (const s of order) {
    if (s.kind === "streak_max") continue;
    const tw = s.label.length * charW;
    const dx = r * 1.3;
    const candidates: Placed[] = [
      { x: s.x_px + dx, y: s.y_px - r * 1.1, anchor: "start" },
      { x: s.x_px - dx, y: s.y_px - r * 1.1, anchor: "end" },
      { x: s.x_px + dx, y: s.y_px + r + font, anchor: "start" },
      { x: s.x_px - dx, y: s.y_px + r + font, anchor: "end" },
    ];
    for (const c of candidates) {
      const x0 = c.anchor === "start" ? c.x : c.x - tw;
      const box: [number, number, number, number] = [x0, c.y - font * 0.8, x0 + tw, c.y + font * 0.2];
      if (box[0] < 0 || box[2] > w || box[1] < 0 || box[3] > h || overlaps(box)) continue;
      boxes.push(box);
      placed.set(s, c);
      break;
    }
  }
  return placed;
};

/**
 * The spot list drawn over an image of the screen -- the simulated pattern,
 * the live camera, a recorded frame. The SVG's user space is the simulation's
 * screen in pixels, stretched over whatever box it sits in, so it lines up
 * with any image of the same screen at any display size.
 *
 * Each mark is a ring, not a dot, so the feature under it stays visible; a
 * dark halo under the ring keeps it readable on a bright streak.
 */
const SpotOverlay = ({
  meta,
  shownKinds,
  showLabels,
  showGeometry = true,
  hovered,
  onHover,
}: {
  meta: RheedSimMeta;
  shownKinds: SpotKind[];
  showLabels: boolean;
  /** The shadow edge, the specular spot and the direct beam. */
  showGeometry?: boolean;
  hovered?: RheedSpot | null;
  /** Given, the rings take the pointer and report the one under it. */
  onHover?: (spot: RheedSpot | null) => void;
}) => {
  const colors = useKindColors();
  const w = meta.screen.width_px ?? 720;
  const h = meta.screen.height_px ?? 540;
  const r = w / 110;
  const font = w / 55;
  const spots = (meta.spots ?? []).filter((s) => s.in_view !== false && shownKinds.includes(s.kind));
  const labels = showLabels ? placeLabels(spots, w, h, r, font) : null;
  const [[x1, y1], [x2, y2]] = meta.shadow_edge_px;
  const [sx, sy] = meta.specular_px;
  const [dx, dy] = meta.direct_beam_px;
  // The zeroth Laue circle: about the origin (the shadow edge's centre, beam
  // shift included) through the specular spot. Only its half on the specular
  // side of the shadow edge is on the screen's lit part, so it is clipped there.
  const [ox, oy] = meta.origin_px;
  const laueR = Math.hypot(sx - ox, sy - oy);
  const ex = x2 - x1;
  const ey = y2 - y1;
  const side = Math.sign(ex * (sy - y1) - ey * (sx - x1)) || 1;
  const far = 4 * (w + h);
  const len = Math.hypot(ex, ey) || 1;
  const [nx, ny] = [(-ey / len) * side * far, (ex / len) * side * far];
  const litHalf = `${x1 - ex * far},${y1 - ey * far} ${x2 + ex * far},${y2 + ey * far} ${x2 + ex * far + nx},${
    y2 + ey * far + ny
  } ${x1 - ex * far + nx},${y1 - ey * far + ny}`;
  const clipId = `laue-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-label="Simulated spot positions"
      role="img"
    >
      {showGeometry && (
        <g fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke">
          <clipPath id={clipId}>
            <polygon points={litHalf} />
          </clipPath>
          {laueR > 0 && (
            <circle
              cx={ox}
              cy={oy}
              r={laueR}
              stroke="rgba(255, 255, 255, 0.55)"
              strokeWidth={1}
              strokeDasharray="2 4"
              clipPath={`url(#${clipId})`}
              vectorEffect="non-scaling-stroke"
            >
              <title>Zeroth Laue circle</title>
            </circle>
          )}
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={HALO} strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="white"
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          >
            <title>Shadow edge</title>
          </line>
          {/* The origin: where the beam's axis meets the shadow edge. */}
          <circle cx={ox} cy={oy} r={r * 0.35} fill="white" stroke={HALO} strokeWidth={1}>
            <title>Origin</title>
          </circle>
          {/* Specular: a diamond. Direct beam: a cross. Neither is a diffraction spot. */}
          <path
            d={`M ${sx} ${sy - r * 1.4} L ${sx + r * 1.4} ${sy} L ${sx} ${sy + r * 1.4} L ${sx - r * 1.4} ${sy} Z`}
            stroke="white"
            vectorEffect="non-scaling-stroke"
          >
            <title>Specular spot</title>
          </path>
          <path
            d={`M ${dx - r} ${dy - r} L ${dx + r} ${dy + r} M ${dx + r} ${dy - r} L ${dx - r} ${dy + r}`}
            stroke="white"
            vectorEffect="non-scaling-stroke"
          >
            <title>Direct beam</title>
          </path>
        </g>
      )}

      {spots.map((s) => {
        const isHovered = hovered === s;
        const key = `${s.kind}:${s.label}:${s.x_px.toFixed(1)}:${s.y_px.toFixed(1)}`;
        return (
          <g
            key={key}
            style={{ pointerEvents: onHover ? "auto" : "none", cursor: onHover ? "default" : undefined }}
            onMouseEnter={onHover && (() => onHover(s))}
            onMouseLeave={onHover && (() => onHover(null))}
          >
            {/* A hit target bigger than the ring. */}
            {onHover && <circle cx={s.x_px} cy={s.y_px} r={r * 2} fill="transparent" />}
            <circle cx={s.x_px} cy={s.y_px} r={r} fill="none" stroke={HALO} strokeWidth={4} vectorEffect="non-scaling-stroke" />
            <circle
              cx={s.x_px}
              cy={s.y_px}
              r={isHovered ? r * 1.4 : r}
              fill="none"
              stroke={colors[s.kind]}
              strokeWidth={isHovered ? 3 : 2}
              vectorEffect="non-scaling-stroke"
            />
            {labels?.has(s) && (
              <text
                x={labels.get(s)!.x}
                y={labels.get(s)!.y}
                textAnchor={labels.get(s)!.anchor}
                fontSize={font}
                fill="white"
                stroke={HALO}
                strokeWidth={3}
                paintOrder="stroke"
                fontFamily="monospace"
              >
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default SpotOverlay;
