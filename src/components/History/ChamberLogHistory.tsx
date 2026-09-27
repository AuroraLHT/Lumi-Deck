import { useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  HStack,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { CartesianMarkerProps, DatumValue } from "@nivo/core";
import { ResponsiveLine, Serie } from "@nivo/line";

import { LogSeries, StepInfo } from "../../generated/lumi";
import { useLogWindow, useSampleSteps } from "../../hooks/useHistory";
import useNivoTheme from "../Plotting/nivoTheme";
import useSeriesPalette from "../Plotting/seriesPalette";
import { logScaleFor, xMarker } from "../Plotting/nivoHelpers";
import { formatDay, formatDuration, formatTime, sessionsOf, WorkSession } from "./history";

/**
 * One chart per quantity, never two scales on one axis. Every column here is
 * in the backend's default set (DEFAULT_LOG_COLUMNS), so the request names
 * none and stays small.
 */
const GROUPS: { title: string; columns: { key: string; label: string }[]; log?: boolean }[] = [
  {
    title: "Heater temperature (°C)",
    columns: [
      { key: "HT Temp moni", label: "Measured" },
      { key: "HT Temp set", label: "Setpoint" },
    ],
  },
  {
    title: "Chamber pressure",
    log: true,
    columns: [
      { key: "Prc Pres Main", label: "Process" },
      { key: "Vac Pres Main", label: "Vacuum" },
    ],
  },
  {
    title: "Gas flow",
    columns: [
      { key: "MFC1 moni", label: "MFC1" },
      { key: "MFC2 moni", label: "MFC2" },
    ],
  },
  { title: "Laser repetition rate (Hz)", columns: [{ key: "LaserHz", label: "Laser Hz" }] },
  { title: "Heater output", columns: [{ key: "HT moni", label: "Heater" }] },
  { title: "Mask1 position (mm)", columns: [{ key: "Mask1", label: "Mask1" }] },
];

/** Log rows either side of the session, so the ramp in and the cool-down show. */
const MARGIN_S = 120;
const MAX_POINTS = 1500;

const clock = (sec: DatumValue) =>
  new Date(Number(sec) * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const LogChart = ({
  title,
  series,
  log,
  markers,
}: {
  title: string;
  series: Serie[];
  log?: boolean;
  markers: CartesianMarkerProps<DatumValue>[];
}) => {
  const theme = useNivoTheme();
  const palette = useSeriesPalette();
  const { colorMode } = useColorMode();

  const empty = series.every((s) => s.data.length === 0);
  const logAxis = log ? logScaleFor(series.flatMap((s) => s.data.map((p) => Number(p.y)))) : null;

  return (
    <Box>
      <Text fontSize="xs" fontWeight="600" mb={1}>
        {title}
      </Text>
      {empty ? (
        <Text fontSize="xs" color="text.muted" h="160px">
          Not in this log.
        </Text>
      ) : (
        <Box h="180px">
          <ResponsiveLine
            // Descending, so nivo's reversed legend reads in column order.
            data={[...series].reverse()}
            theme={theme}
            colors={(s) => palette[Number(s.order) || 0]}
            margin={{ top: series.length > 1 ? 22 : 8, right: 12, bottom: 28, left: 56 }}
            xScale={{ type: "linear", min: "auto", max: "auto" }}
            yScale={logAxis?.scale ?? { type: "linear", min: "auto", max: "auto" }}
            axisBottom={{ tickValues: 5, format: clock }}
            axisLeft={{ tickValues: logAxis?.ticks ?? 4, format: logAxis ? ".0e" : undefined }}
            gridYValues={logAxis?.ticks}
            lineWidth={2}
            enablePoints={false}
            enableGridX={false}
            useMesh
            crosshairType="x"
            markers={markers}
            tooltip={({ point }) => (
              <Box
                bg={colorMode === "dark" ? "#1a222c" : "white"}
                px={2}
                py={1}
                borderRadius="md"
                fontSize="xs"
                boxShadow="md"
              >
                {String(point.serieId)}: {+Number(point.data.y).toPrecision(4)} at{" "}
                {formatTime(Number(point.data.x), false)}
              </Box>
            )}
            legends={
              series.length > 1
                ? [
                    {
                      anchor: "top-left",
                      direction: "row",
                      translateY: -20,
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
      )}
    </Box>
  );
};

/**
 * The log's columns -> one series per group column, numbers only (a log scale
 * drops <= 0). With `file` set, only the rows that came from that log file.
 */
const toSeries = (log: LogSeries, group: (typeof GROUPS)[number], file: number | null): Serie[] =>
  group.columns.map((column, order) => {
    const values = log.columns?.[column.key] ?? [];
    const data: { x: number; y: number }[] = [];
    (log.time ?? []).forEach((t, i) => {
      if (file !== null && log.file_index?.[i] !== file) return;
      const y = values[i];
      if (typeof y === "number" && Number.isFinite(y) && (!group.log || y > 0)) data.push({ x: t, y });
    });
    return { id: column.label, order, data };
  });

const sessionLabel = (s: WorkSession) =>
  `${formatDay(s.start)}, ${formatTime(s.start, false)} (${formatDuration(s.end - s.start)}, ${s.steps.length} steps)`;

/**
 * The chamber log over the hours this sample was worked on -- read back from
 * PASCAL's log files, which the backend stitches across file boundaries. One
 * working session at a time: a sample grown in layers over days would
 * otherwise be days of idle chamber thinned to nothing.
 */
const ChamberLogHistory = ({ sampleId }: { sampleId: number }) => {
  const theme = useNivoTheme();
  const steps = useSampleSteps(sampleId);
  const sessions = useMemo(() => sessionsOf(steps.data?.steps ?? []), [steps.data]);
  const [picked, setPicked] = useState<number | null>(null);
  const [pickedFile, setPickedFile] = useState<number | null>(null);
  const session = sessions.find((s) => s.start === picked) ?? sessions[sessions.length - 1] ?? null;

  const logWindow = useLogWindow(
    session
      ? { since: session.start - MARGIN_S, until: session.end + MARGIN_S, max_points: MAX_POINTS }
      : null
  );

  const depositions: StepInfo[] = useMemo(
    () => (session?.steps ?? []).filter((s) => s.kind === "perform_deposition"),
    [session]
  );
  // Rows per log file in this window. PASCAL writes one file at a time, but a
  // clock change or a copied-in file can make two overlap, and merged by time
  // their rows alternate between two sessions -- a chart of that is noise. So
  // on an overlap, one file is shown: the one that holds most of the window.
  const log = logWindow.data;
  const fileRows = useMemo(() => {
    const counts = (log?.files ?? []).map(() => 0);
    for (const i of log?.file_index ?? []) counts[i] = (counts[i] ?? 0) + 1;
    return counts;
  }, [log]);
  const mainFile = fileRows.length ? fileRows.indexOf(Math.max(...fileRows)) : null;
  const shownFile = log?.overlap ? (pickedFile !== null && pickedFile < fileRows.length ? pickedFile : mainFile) : null;

  const guide = theme.axis.ticks.text.fill;
  const markers: CartesianMarkerProps<DatumValue>[] = depositions.flatMap((d) =>
    [d.started_at, d.ended_at]
      .filter((t): t is number => t != null)
      .map((value) => xMarker(value, { stroke: guide, strokeWidth: 1, strokeDasharray: "4 3" }))
  );

  if (steps.isPending && steps.nodeUp) return <Spinner size="sm" />;
  if (steps.isError) return <Text color="status.error">{steps.error.message}</Text>;
  if (!session) return <Text color="text.muted">No steps recorded, so there is no time to read the log for.</Text>;

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={3} flexWrap="wrap" rowGap={2}>
        {sessions.length > 1 && (
          <Select
            size="sm"
            aria-label="Session"
            value={session.start}
            onChange={(e) => setPicked(Number(e.target.value))}
            maxW="420px"
            borderRadius="md"
          >
            {sessions.map((s) => (
              <option key={s.start} value={s.start}>
                {sessionLabel(s)}
              </option>
            ))}
          </Select>
        )}
        <Text fontSize="xs" color="text.muted">
          {formatTime(session.start - MARGIN_S)} – {formatTime(session.end + MARGIN_S, false)}
          {log && ` · ${log.n_rows} rows${(log.stride ?? 1) > 1 ? `, 1 in ${log.stride} shown` : ""}`}
          {depositions.length > 0 && " · dashed lines bracket each deposition"}
        </Text>
      </HStack>

      {log?.overlap && shownFile !== null && (
        <Alert status="warning" borderRadius="md" fontSize="sm" py={2}>
          <AlertIcon />
          <Box flex={1}>
            <Text>
              Two log files overlap in this window, so their rows would interleave. Showing one file:
            </Text>
            <Select
              size="sm"
              mt={1}
              maxW="420px"
              aria-label="Log file"
              value={shownFile}
              onChange={(e) => setPickedFile(Number(e.target.value))}
              borderRadius="md"
            >
              {(log.files ?? []).map((name, i) => (
                <option key={name} value={i}>
                  {name} ({fileRows[i] ?? 0} rows)
                </option>
              ))}
            </Select>
          </Box>
        </Alert>
      )}

      {!logWindow.nodeUp ? (
        <Text color="text.muted">The chamber node is not running, so its logs cannot be read.</Text>
      ) : logWindow.isPending ? (
        <HStack color="text.muted">
          <Spinner size="sm" />
          <Text fontSize="sm">Reading the chamber log…</Text>
        </HStack>
      ) : logWindow.isError ? (
        <Text color="status.error">{logWindow.error.message}</Text>
      ) : !log?.n_rows ? (
        <Text color="text.muted">The chamber logged nothing in this window.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacingX={6} spacingY={4}>
          {GROUPS.map((group) => (
            <LogChart
              key={group.title}
              title={group.title}
              series={toSeries(log, group, shownFile)}
              log={group.log}
              markers={markers}
            />
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
};

export default ChamberLogHistory;
