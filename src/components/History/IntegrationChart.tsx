import { useMemo } from "react";
import { Box, Text, useColorMode } from "@chakra-ui/react";
import { CartesianMarkerProps, DatumValue } from "@nivo/core";
import { ResponsiveLine, Serie } from "@nivo/line";

import { IntegrationTrace, StepInfo } from "../../generated/lumi";
import useNivoTheme from "../Plotting/nivoTheme";
import useSeriesPalette, { MAX_SERIES } from "../Plotting/seriesPalette";
import { xMarker } from "../Plotting/nivoHelpers";

/**
 * Each integration box's mean intensity over a recording, against seconds
 * since it started -- the RHEED oscillations, one line per box, coloured as
 * the box is on the frame above.
 *
 * The solid line is the frame on screen; the dashed pair brackets the
 * deposition (shutter open to closed). Clicking the curve moves the frame
 * there.
 */
const IntegrationChart = ({
  traces,
  t0,
  cursor,
  deposition,
  onSeek,
}: {
  traces: IntegrationTrace[];
  t0: number;
  cursor: number | null;
  deposition: StepInfo | null;
  onSeek: (time: number) => void;
}) => {
  const theme = useNivoTheme();
  const palette = useSeriesPalette();
  const { colorMode } = useColorMode();

  const data: Serie[] = useMemo(
    () =>
      // Descending: nivo lists legend items in reverse series order.
      traces
        .slice(0, MAX_SERIES)
        .map((trace, i) => ({
          id: `Box ${trace.bbox_id}`,
          order: i,
          data: (trace.time ?? []).map((t, j) => ({ x: t - t0, y: trace.mean?.[j] ?? null })),
        }))
        .reverse(),
    [traces, t0]
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
      <Box h={{ base: "240px", xl: "320px" }} w="100%" cursor="pointer">
        <ResponsiveLine
          data={data}
          theme={theme}
          colors={(serie) => palette[Number(serie.order) || 0]}
          margin={{ top: 28, right: 16, bottom: 40, left: 56 }}
          xScale={{ type: "linear", min: 0, max: "auto" }}
          yScale={{ type: "linear", min: "auto", max: "auto" }}
          axisBottom={{
            tickValues: 6,
            legend: "Seconds since recording started",
            legendPosition: "middle",
            legendOffset: 32,
          }}
          axisLeft={{
            tickValues: 4,
            legend: "Mean intensity",
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
              {String(point.serieId)}: {Number(point.data.y).toFixed(1)} at +
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
                    itemWidth: 64,
                    itemHeight: 12,
                    symbolSize: 8,
                    symbolShape: "circle",
                  },
                ]
              : []
          }
        />
      </Box>
      {traces.length > MAX_SERIES && (
        <Text fontSize="xs" color="text.muted">
          Showing the first {MAX_SERIES} of {traces.length} boxes.
        </Text>
      )}
    </>
  );
};

export default IntegrationChart;
