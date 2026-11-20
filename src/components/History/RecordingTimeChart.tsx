import { useMemo } from "react";
import { Box, Text, useColorMode } from "@chakra-ui/react";
import { CartesianMarkerProps, DatumValue } from "@nivo/core";
import { ResponsiveLine, Serie } from "@nivo/line";

import { StepInfo } from "../../generated/lumi";
import useNivoTheme from "../Plotting/nivoTheme";
import useSeriesPalette, { MAX_SERIES } from "../Plotting/seriesPalette";
import { xMarker } from "../Plotting/nivoHelpers";

export interface TimeLine {
  id: string;
  /** Unix seconds. */
  time: number[];
  values: (number | null)[];
}

/**
 * Lines over a recording against seconds since it started: the integration
 * boxes' intensity, the detector's class scores.
 *
 * The solid line is the frame on screen; the dashed pair brackets the
 * deposition (shutter open to closed). Clicking the curve moves the frame
 * there.
 */
const RecordingTimeChart = ({
  lines,
  t0,
  cursor,
  deposition,
  onSeek,
  yLegend,
  yRange,
  digits = 1,
  what = "lines",
  height = { base: "240px", xl: "320px" },
}: {
  lines: TimeLine[];
  t0: number;
  cursor: number | null;
  deposition: StepInfo | null;
  onSeek: (time: number) => void;
  yLegend: string;
  /** Fixed y limits; auto when left out. */
  yRange?: [number, number];
  digits?: number;
  /** What a line is, for the "first N of M" note. */
  what?: string;
  height?: { base: string; xl: string };
}) => {
  const theme = useNivoTheme();
  const palette = useSeriesPalette();
  const { colorMode } = useColorMode();

  const data: Serie[] = useMemo(
    () =>
      // Descending: nivo lists legend items in reverse series order.
      lines
        .slice(0, MAX_SERIES)
        .map((line, i) => ({
          id: line.id,
          order: i,
          data: line.time.map((t, j) => ({ x: t - t0, y: line.values[j] ?? null })),
        }))
        .reverse(),
    [lines, t0]
  );

  const guide = theme.axis.ticks.text.fill;
  const dashed = { stroke: guide, strokeWidth: 1, strokeDasharray: "4 3" };
  const markers: CartesianMarkerProps<DatumValue>[] = [];
  if (deposition?.started_at != null) {
    markers.push(xMarker(deposition.started_at - t0, dashed, { text: "deposition", fill: guide }));
    if (deposition.ended_at != null) markers.push(xMarker(deposition.ended_at - t0, dashed));
  }
  if (cursor != null) {
    markers.push(xMarker(cursor - t0, { stroke: theme.text.fill, strokeWidth: 1.5 }));
  }

  if (!data.length) return null;

  return (
    <>
      <Box h={height} w="100%" cursor="pointer">
        <ResponsiveLine
          data={data}
          theme={theme}
          colors={(serie) => palette[Number(serie.order) || 0]}
          margin={{ top: 28, right: 16, bottom: 40, left: 56 }}
          xScale={{ type: "linear", min: 0, max: "auto" }}
          yScale={{ type: "linear", min: yRange?.[0] ?? "auto", max: yRange?.[1] ?? "auto" }}
          axisBottom={{
            tickValues: 6,
            legend: "Seconds since recording started",
            legendPosition: "middle",
            legendOffset: 32,
          }}
          axisLeft={{
            tickValues: 4,
            legend: yLegend,
            legendPosition: "middle",
            legendOffset: -48,
          }}
          lineWidth={2}
          enablePoints={false}
          enableGridX={false}
          useMesh
          crosshairType="x"
          onClick={(point) => onSeek(t0 + Number(point.data.x))}
          tooltip={({ point }) => (
            <Box
              bg={colorMode === "dark" ? "#1a222c" : "white"}
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
              boxShadow="md"
            >
              {String(point.serieId)}: {Number(point.data.y).toFixed(digits)} at +
              {Number(point.data.x).toFixed(1)} s
            </Box>
          )}
          markers={markers}
          legends={
            data.length > 1
              ? [
                  {
                    anchor: "top-left",
                    direction: "row",
                    translateY: -24,
                    itemWidth: Math.max(64, 8 * Math.max(...data.map((d) => String(d.id).length)) + 16),
                    itemHeight: 12,
                    symbolSize: 8,
                    symbolShape: "circle",
                  },
                ]
              : []
          }
        />
      </Box>
      {lines.length > MAX_SERIES && (
        <Text fontSize="xs" color="text.muted">
          Showing the first {MAX_SERIES} of {lines.length} {what}.
        </Text>
      )}
    </>
  );
};

export default RecordingTimeChart;
