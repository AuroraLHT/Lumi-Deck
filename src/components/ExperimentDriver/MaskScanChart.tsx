import { useMemo } from "react";
import { Box, useColorMode } from "@chakra-ui/react";
import { ResponsiveLine, Serie } from "@nivo/line";

import useNivoTheme from "../Plotting/nivoTheme";
import useSeriesPalette from "../Plotting/seriesPalette";
import { xMarker } from "../Plotting/nivoHelpers";
import { MaskAlignResult } from "../../generated/lumi";

/**
 * Intensity at the `mask-center` marker against Mask1 position, one line per
 * scan pass. The dip (or peak) is the slit crossing the marker; the dashed
 * line is where the fit put its center (unlabelled: any spot for the label
 * collides with the scan points, and the value is printed right above). This is the picture an operator would
 * otherwise have to trust the single `center` number for.
 */
const MaskScanChart = ({ result }: { result: MaskAlignResult }) => {
  const theme = useNivoTheme();
  const { colorMode } = useColorMode();
  // By pass, in fixed order: a re-run with fewer passes keeps its colours. The
  // legend and the pass list beside the chart carry identity, not colour alone.
  const palette = useSeriesPalette();

  const data: Serie[] = useMemo(() => {
    const byPass = new Map<number, { x: number; y: number }[]>();
    for (const point of result.samples ?? []) {
      const pass = point.pass_index ?? 0;
      const list = byPass.get(pass) ?? [];
      list.push({ x: point.position, y: point.reading });
      byPass.set(pass, list);
    }
    // Descending: nivo lists legend items in reverse series order, so this
    // is what makes the legend read "Wide scan, Pass 2, ..." left to right.
    return [...byPass.entries()]
      .sort(([a], [b]) => b - a)
      .map(([pass, points]) => ({
        id: pass === 0 ? "Wide scan" : `Pass ${pass + 1}`,
        pass,
        data: points.sort((a, b) => a.x - b.x),
      }));
  }, [result.samples]);

  if (data.length === 0) return null;

  return (
    <Box h="200px" w="100%">
      <ResponsiveLine
        data={data}
        theme={theme}
        colors={(serie) => palette[Math.min(Number(serie.pass) || 0, palette.length - 1)]}
        margin={{ top: 28, right: 16, bottom: 40, left: 48 }}
        xScale={{ type: "linear", min: "auto", max: "auto" }}
        yScale={{ type: "linear", min: "auto", max: "auto" }}
        axisBottom={{
          tickValues: 5,
          format: ".1f",
          legend: "Mask1 position (mm)",
          legendPosition: "middle",
          legendOffset: 32,
        }}
        axisLeft={{ tickValues: 4, legend: "Reading", legendPosition: "middle", legendOffset: -40 }}
        lineWidth={2}
        pointSize={8}
        pointBorderWidth={2}
        pointBorderColor={colorMode === "dark" ? "#151c24" : "#ffffff"}
        enableGridX={false}
        useMesh
        crosshairType="bottom-left"
        tooltip={({ point }) => (
          <Box
            bg={colorMode === "dark" ? "#1a222c" : "white"}
            px={2}
            py={1}
            borderRadius="md"
            fontSize="xs"
            boxShadow="md"
          >
            {String(point.serieId)}: {Number(point.data.x).toFixed(3)} mm →{" "}
            {Number(point.data.y).toFixed(1)}
          </Box>
        )}
        markers={[
          xMarker(result.center, {
            stroke: theme.axis.ticks.text.fill,
            strokeWidth: 1,
            strokeDasharray: "4 3",
          }),
        ]}
        legends={
          data.length > 1
            ? [
                {
                  anchor: "top-left",
                  direction: "row",
                  translateY: -24,
                  itemWidth: 72,
                  itemHeight: 12,
                  symbolSize: 8,
                  symbolShape: "circle",
                },
              ]
            : []
        }
      />
    </Box>
  );
};

export default MaskScanChart;
