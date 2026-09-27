import { CartesianMarkerProps, DatumValue } from "@nivo/core";

/**
 * A vertical nivo marker at `x`. nivo's runtime prop-types require the legend
 * offsets and orientation on every marker, labelled or not, though its TS
 * types leave them out -- so they are always set here.
 */
export const xMarker = (
  value: number,
  lineStyle: CartesianMarkerProps<DatumValue>["lineStyle"],
  legend?: { text: string; fill: string }
): CartesianMarkerProps<DatumValue> => ({
  axis: "x",
  value,
  lineStyle,
  ...(legend
    ? { legend: legend.text, legendPosition: "top-right", textStyle: { fill: legend.fill, fontSize: 10 } }
    : {}),
  ...{ legendOrientation: "horizontal", legendOffsetX: 4, legendOffsetY: 4 },
});

/**
 * A nivo log y-scale with explicit bounds, rounded out to whole decades, and a
 * tick at each decade. Given `min/max: "auto"`, nivo's log scale comes out
 * upside down (larger values drawn lower) and ticks every 1..9 x 10^n, which
 * crowd into an unreadable column -- so both are set here from the data.
 */
export const logScaleFor = (values: number[]) => {
  const positive = values.filter((v) => v > 0 && Number.isFinite(v));
  if (!positive.length) return null;
  const lo = Math.floor(Math.log10(Math.min(...positive)));
  const hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(...positive))));
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i));
  return {
    scale: { type: "log" as const, base: 10, min: 10 ** lo, max: 10 ** hi },
    ticks,
  };
};
