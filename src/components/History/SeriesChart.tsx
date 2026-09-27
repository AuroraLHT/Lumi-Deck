import { useMemo } from "react";
import { Box, Text, VStack, useColorMode } from "@chakra-ui/react";
import { ResponsiveLine, Serie } from "@nivo/line";

import { MeasurementSeries, SeriesAxis } from "../../generated/lumi";
import useNivoTheme from "../Plotting/nivoTheme";
import useSeriesPalette, { MAX_SERIES } from "../Plotting/seriesPalette";
import { logScaleFor } from "../Plotting/nivoHelpers";

/** More points than this are thinned for drawing (every k-th); the data is not. */
const MAX_DRAWN = 2000;

const axisLabel = (axis: Pick<SeriesAxis, "name" | "unit">) =>
  axis.unit ? `${axis.name} (${axis.unit})` : axis.name;

/**
 * One measurement series: its y columns against x. Columns in different
 * units get a chart each -- never two scales on one axis -- and columns in
 * the same unit share one, coloured in column order. `meta.log_scale` puts y
 * on a log axis (an XRD scan spans decades), dropping values <= 0.
 */
const SeriesChart = ({ series }: { series: MeasurementSeries }) => {
  const theme = useNivoTheme();
  const palette = useSeriesPalette();
  const { colorMode } = useColorMode();
  const log = series.meta?.log_scale === true;

  const n = series.x.values.length;
  const stride = Math.max(1, Math.ceil(n / MAX_DRAWN));

  // y columns grouped by unit, each keeping its column index for its colour.
  const groups = useMemo(() => {
    const byUnit = new Map<string, { axis: SeriesAxis; order: number }[]>();
    series.y.forEach((axis, order) => {
      const key = axis.unit ?? "";
      byUnit.set(key, [...(byUnit.get(key) ?? []), { axis, order }]);
    });
    return [...byUnit.values()].map((columns) => {
      const data: Serie[] = columns
        .slice(0, MAX_SERIES)
        .map(({ axis, order }) => {
          const points: { x: number; y: number }[] = [];
          for (let i = 0; i < n; i += stride) {
            const y = axis.values[i];
            if (Number.isFinite(y) && (!log || y > 0)) points.push({ x: series.x.values[i], y });
          }
          return { id: axis.name, order, data: points };
        })
        // Descending: nivo lists legend items in reverse series order.
        .reverse();
      return { columns, data };
    });
  }, [series, n, stride, log]);

  return (
    <VStack align="stretch" spacing={3}>
      {groups.map(({ columns, data }) => {
        const logAxis = log ? logScaleFor(data.flatMap((d) => d.data.map((p) => Number(p.y)))) : null;
        const title =
          columns.length === 1 ? axisLabel(columns[0].axis) : columns[0].axis.unit ?? "value";
        return (
          <Box key={title}>
            <Box h="220px" role="img" aria-label={`${series.name}: ${title} against ${axisLabel(series.x)}`}>
              <ResponsiveLine
                data={data}
                theme={theme}
                colors={(s) => palette[Number(s.order) || 0]}
                margin={{ top: data.length > 1 ? 24 : 10, right: 16, bottom: 40, left: 64 }}
                xScale={{ type: "linear", min: "auto", max: "auto" }}
                yScale={logAxis?.scale ?? { type: "linear", min: "auto", max: "auto" }}
                axisBottom={{
                  tickValues: 6,
                  legend: axisLabel(series.x),
                  legendPosition: "middle",
                  legendOffset: 32,
                }}
                axisLeft={{
                  tickValues: logAxis?.ticks ?? 5,
                  format: logAxis ? ".0e" : undefined,
                  legend: title,
                  legendPosition: "middle",
                  legendOffset: -56,
                }}
                lineWidth={2}
                enablePoints={false}
                enableGridX={false}
                gridYValues={logAxis?.ticks}
                useMesh
                crosshairType="x"
                tooltip={({ point }) => (
                  <Box
                    bg={colorMode === "dark" ? "#1a222c" : "white"}
                    px={2}
                    py={1}
                    borderRadius="md"
                    fontSize="xs"
                    boxShadow="md"
                  >
                    {String(point.serieId)} {+Number(point.data.y).toPrecision(5)} at{" "}
                    {series.x.name} {+Number(point.data.x).toPrecision(5)}
                  </Box>
                )}
                legends={
                  data.length > 1
                    ? [
                        {
                          anchor: "top-left",
                          direction: "row",
                          translateY: -20,
                          itemWidth: 80,
                          itemHeight: 12,
                          symbolSize: 8,
                          symbolShape: "circle",
                        },
                      ]
                    : []
                }
              />
            </Box>
            {columns.length > MAX_SERIES && (
              <Text fontSize="xs" color="text.muted">
                Showing the first {MAX_SERIES} of {columns.length} columns in {title}.
              </Text>
            )}
          </Box>
        );
      })}
      <Text fontSize="xs" color="text.muted">
        {n} points{stride > 1 && `, 1 in ${stride} drawn`}
        {log && " · log scale"}
      </Text>
    </VStack>
  );
};

export default SeriesChart;
