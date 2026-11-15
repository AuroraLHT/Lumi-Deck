import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Grid,
  HStack,
  Icon,
  IconButton,
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { LuAtom, LuChevronLeft, LuChevronRight, LuPause, LuPlay } from "react-icons/lu";
import { Link as RouterLink } from "react-router-dom";

import { IntegrationBox, RecordingInfo } from "../../generated/lumi";
import {
  useRecordingDetection,
  useRecordingDetections,
  useRecordingEvents,
  useRecordingFrame,
  useRecordingInfo,
  useRecordingIntegration,
  useSampleSteps,
} from "../../hooks/useHistory";
import useSeriesPalette, { MAX_SERIES } from "../Plotting/seriesPalette";
import IntegrationChart from "./IntegrationChart";
import SimSpotsLayer from "../Simulation/SimSpotsLayer";
import { detectionAt, formatDuration, formatTime, nearestFrame, recordingsOf, SampleRecording } from "./history";
import {
  DetectionChart,
  DetectionOverlay,
  EventList,
  MetadataPanel,
  SectionTitle,
} from "./RecordingExtras";

/** Playback speed: frames shown per second, whatever the recording's own rate was. */
const PLAY_FPS = 6;

const recordingLabel = (r: SampleRecording, i: number) => {
  const material = r.deposition?.params?.target_material;
  return `${i + 1}. ${typeof material === "string" ? material : "Recording"} · ${formatTime(r.startedAt)}`;
};

/** The integration boxes drawn over the frame, in the chart's series colours. */
/**
 * The integration boxes in place at `time`. A v2 file keeps each box's span, so
 * a box moved or added mid-growth is drawn where it was then; a v1 file only
 * knows the boxes at the end.
 */
const boxesAt = (info: RecordingInfo, time: number | null): IntegrationBox[] => {
  const history = info.box_history ?? [];
  if (!history.length || time == null) return info.boxes ?? [];
  return history.filter((b) => b.t_from <= time && (b.t_to == null || time < b.t_to));
};

const BoxOverlay = ({ boxes, shape }: { boxes: IntegrationBox[]; shape: number[] }) => {
  const palette = useSeriesPalette();
  const [height, width] = shape;
  return (
    <Box
      as="svg"
      position="absolute"
      inset={0}
      w="100%"
      h="100%"
      viewBox={`0 0 ${width} ${height}`}
      pointerEvents="none"
      aria-hidden
    >
      {boxes.slice(0, MAX_SERIES).map((b, i) => (
        <g key={b.bbox_id}>
          <rect
            x={b.center_x - b.width / 2}
            y={b.center_y - b.height / 2}
            width={b.width}
            height={b.height}
            fill="none"
            stroke={palette[i]}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={b.center_x - b.width / 2}
            y={b.center_y - b.height / 2 - 4}
            fill={palette[i]}
            fontSize={14}
            fontWeight={700}
          >
            {`Box ${b.bbox_id}`}
          </text>
        </g>
      ))}
    </Box>
  );
};

const Player = ({ info, deposition }: { info: RecordingInfo; deposition: SampleRecording["deposition"] }) => {
  const nFrames = info.frame_times?.length ?? 0;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [simSpots, setSimSpots] = useState(false);
  const [showDetections, setShowDetections] = useState(true);
  const live = Boolean(info.recording);

  const frame = useRecordingFrame(nFrames ? info.name : null, index);
  const integration = useRecordingIntegration(info.n_integrations ? info.name : null, undefined, live);
  const detections = useRecordingDetections(info.n_detections ? info.name : null, live);
  const events = useRecordingEvents(info.format_version === 2 ? info.name : null, live);

  // Advance only once the frame on screen is the one asked for, so playback
  // never outruns the backend and skips frames nobody saw.
  const shown = frame.isSuccess && !frame.isPlaceholderData;
  useEffect(() => {
    if (!playing || !shown) return;
    if (index >= nFrames - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), 1000 / PLAY_FPS);
    return () => clearTimeout(timer);
  }, [playing, shown, index, nFrames]);

  const frameTimes = info.frame_times ?? [];
  const t0 = info.start ?? frameTimes[0] ?? 0;
  const frameTime = frameTimes[index] ?? null;
  const shape = info.frame_shape ?? [frame.data?.height ?? 540, frame.data?.width ?? 720];
  const detectionIndex = showDetections ? detectionAt(detections.data, frameTime) : null;
  const detection = useRecordingDetection(detectionIndex !== null ? info.name : null, detectionIndex);
  const seek = (time: number) => {
    setPlaying(false);
    setIndex(nearestFrame(frameTimes, time));
  };

  if (!nFrames) {
    return (
      <Text fontSize="sm" color="text.muted">
        This recording saved no frames.
      </Text>
    );
  }

  return (
    <Grid
      templateColumns={{ base: "minmax(0, 1fr)", xl: "minmax(0, 560px) minmax(0, 1fr)" }}
      gap={5}
      alignItems="start"
    >
      <VStack align="stretch" spacing={3}>
        <Box
          position="relative"
          bg="black"
          borderRadius="md"
          overflow="hidden"
          maxW="560px"
          w="100%"
          mx="auto"
          style={{ aspectRatio: `${shape[1]} / ${shape[0]}` }}
        >
          {frame.data && (
            <img
              src={frame.data.url}
              alt={`RHEED frame ${index + 1} of ${nFrames}`}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          )}
          <BoxOverlay boxes={boxesAt(info, frameTime)} shape={shape} />
          {detectionIndex !== null && detection.data && (
            <DetectionOverlay boxes={detection.data.boxes ?? []} crop={detection.data.crop} shape={shape} />
          )}
          {simSpots && <SimSpotsLayer energyKev={info.rheed_energy_kev ?? null} frame={shape} />}
          {frame.isFetching && (
            <Spinner size="sm" color="white" position="absolute" top={2} right={2} />
          )}
          {frame.isError && (
            <Text position="absolute" bottom={2} left={2} fontSize="xs" color="red.300">
              {frame.error.message}
            </Text>
          )}
        </Box>

        <HStack spacing={2} maxW="560px" w="100%" mx="auto">
          <IconButton
            aria-label={playing ? "Pause" : "Play"}
            icon={<Icon as={playing ? LuPause : LuPlay} />}
            size="sm"
            variant="panelGhost"
            onClick={() => {
              if (!playing && index >= nFrames - 1) setIndex(0);
              setPlaying(!playing);
            }}
          />
          <IconButton
            aria-label="Previous frame"
            icon={<Icon as={LuChevronLeft} />}
            size="sm"
            variant="panelGhost"
            isDisabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          />
          <Slider
            aria-label="Frame"
            min={0}
            max={nFrames - 1}
            value={index}
            onChange={(i) => {
              setPlaying(false);
              setIndex(i);
            }}
            focusThumbOnChange={false}
            flex={1}
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <IconButton
            aria-label="Next frame"
            icon={<Icon as={LuChevronRight} />}
            size="sm"
            variant="panelGhost"
            isDisabled={index >= nFrames - 1}
            onClick={() => setIndex((i) => Math.min(nFrames - 1, i + 1))}
          />
          {Boolean(info.n_detections) && (
            <Tooltip label="The detector's boxes on this frame" openDelay={300}>
              <IconButton
                aria-label={showDetections ? "Hide detections" : "Show detections"}
                aria-pressed={showDetections}
                icon={<Box w="12px" h="10px" border="2px solid" borderColor="purple.400" borderRadius="1px" />}
                size="sm"
                variant={showDetections ? "solid" : "panelGhost"}
                colorScheme={showDetections ? "purple" : undefined}
                onClick={() => setShowDetections(!showDetections)}
              />
            </Tooltip>
          )}
          <Tooltip label="Simulated spots at this recording's beam energy (scene from the Simulation page)" openDelay={300}>
            <IconButton
              aria-label={simSpots ? "Hide simulated spots" : "Show simulated spots"}
              aria-pressed={simSpots}
              icon={<Icon as={LuAtom} />}
              size="sm"
              variant={simSpots ? "solid" : "panelGhost"}
              colorScheme={simSpots ? "blue" : undefined}
              onClick={() => setSimSpots(!simSpots)}
            />
          </Tooltip>
          <Text fontSize="xs" color="text.secondary" fontFamily="mono" minW="120px" textAlign="right">
            {index + 1}/{nFrames} · +{formatDuration(frameTime != null ? frameTime - t0 : null) || "0s"}
          </Text>
        </HStack>
        {frame.data && (
          <Text fontSize="xs" color="text.muted" textAlign="center">
            {formatTime(frameTime)} · contrast {Math.round(frame.data.low)}–{Math.round(frame.data.high)}{" "}
            (fixed for the whole recording)
            {showDetections && Boolean(info.n_detections) && (
              <>
                {" · "}
                {detectionIndex === null
                  ? "no detection within 1 s"
                  : `${detection.data?.boxes?.length ?? "…"} boxes`}
              </>
            )}
          </Text>
        )}
        {simSpots && (
          <Text fontSize="xs" color="text.muted" textAlign="center">
            Spots for the scene on the{" "}
            <Text as={RouterLink} to="/simulation" color="accent.solid" textDecoration="underline">
              Simulation page
            </Text>
            , at {info.rheed_energy_kev ?? "the lab's"} keV.
          </Text>
        )}

      </VStack>

      <VStack align="stretch" spacing={5} minW={0}>
      <Box>
        <SectionTitle loading={integration.isFetching && !integration.isPending}>Integrated intensity</SectionTitle>
        {!info.n_integrations ? (
          <Text fontSize="sm" color="text.muted">
            This recording saved no integration boxes.
          </Text>
        ) : integration.isPending ? (
          <Spinner size="sm" />
        ) : integration.isError ? (
          <Text fontSize="sm" color="status.error">
            {integration.error.message}
          </Text>
        ) : (
          <IntegrationChart
            traces={integration.data.traces ?? []}
            t0={t0}
            cursor={frameTime}
            deposition={deposition}
            onSeek={seek}
          />
        )}
      </Box>

      {Boolean(info.n_detections) && (
        <Box>
          <SectionTitle loading={detections.isFetching}>Detector</SectionTitle>
          {detections.isError ? (
            <Text fontSize="sm" color="status.error">
              {detections.error.message}
            </Text>
          ) : detections.data ? (
            <>
              <DetectionChart
                detections={detections.data}
                t0={t0}
                cursor={frameTime}
                deposition={deposition}
                onSeek={seek}
              />
              <Text fontSize="xs" color="text.muted">
                {detections.data.n_detections?.toLocaleString()} detections
                {(detections.data.stride ?? 1) > 1 && `, 1 in ${detections.data.stride} charted`}
              </Text>
            </>
          ) : null}
        </Box>
      )}

      {info.format_version === 2 && (
        <Box>
          <SectionTitle loading={events.isFetching}>Events</SectionTitle>
          {events.isError ? (
            <Text fontSize="sm" color="status.error">
              {events.error.message}
            </Text>
          ) : events.data?.events?.length ? (
            <EventList events={events.data.events} t0={t0} onSeek={seek} />
          ) : events.data ? (
            <Text fontSize="sm" color="text.muted">
              Nothing was logged.
            </Text>
          ) : null}
        </Box>
      )}
      </VStack>
    </Grid>
  );
};

/** v2 files say who, why and whether they were closed cleanly; v1 files do not. */
const RecordingHeader = ({ info }: { info: RecordingInfo }) => (
  <VStack align="stretch" spacing={1}>
    <HStack spacing={2} flexWrap="wrap" rowGap={1}>
      {info.recording ? (
        <Badge colorScheme="red" variant="subtle" display="flex" alignItems="center" gap={1}>
          <Box w="6px" h="6px" borderRadius="full" bg="red.400" />
          Recording
        </Badge>
      ) : info.complete === false ? (
        <Tooltip label="The file was not closed cleanly: the recorder stopped without finishing it. What was written is readable.">
          <Badge colorScheme="orange" variant="subtle">
            Not closed
          </Badge>
        </Tooltip>
      ) : null}
      <Badge variant="outline" fontSize="0.6rem">
        {info.format_version ? `v${info.format_version}` : "v1"}
      </Badge>
      <Text fontSize="xs" color="text.muted">
        {formatTime(info.start)} · {info.n_frames ?? 0} frames ·{" "}
        {formatDuration((info.end ?? 0) - (info.start ?? 0))} · {((info.size_bytes ?? 0) / 1e6).toFixed(0)} MB
        {info.rheed_energy_kev != null && (
          <>
            {" · "}
            <Tooltip
              label={
                info.rheed_energy_recorded
                  ? "Beam energy stored with the recording"
                  : "Recorded before files kept their beam energy: this is the lab's configured default"
              }
              openDelay={300}
            >
              <Text as="span" borderBottom={info.rheed_energy_recorded ? undefined : "1px dotted"}>
                {info.rheed_energy_kev} keV{info.rheed_energy_recorded ? "" : " (assumed)"}
              </Text>
            </Tooltip>
          </>
        )}
        {info.recording && " · updating every 5 s"}
      </Text>
    </HStack>
    {(info.operator || info.note) && (
      <Text fontSize="sm">
        {info.operator && (
          <Text as="span" fontWeight="600">
            {info.operator}
          </Text>
        )}
        {info.operator && info.note && " — "}
        {info.note}
      </Text>
    )}
  </VStack>
);

/**
 * One recording, by file name: its header, the frame player with the charts
 * and events beside it, and what the file says about itself.
 */
export const RecordingBody = ({
  name,
  deposition = null,
}: {
  name: string;
  deposition?: SampleRecording["deposition"];
}) => {
  const info = useRecordingInfo(name);

  if (!info.nodeUp) return <Text color="text.muted">The storage node is not running, so recordings cannot be read.</Text>;
  if (info.isPending) return <Spinner size="sm" />;
  if (info.isError) return <Text color="status.error">{info.error.message}</Text>;
  if (info.data.error) return <Text color="status.error">This file cannot be read: {info.data.error}</Text>;
  // A v1 file cannot be opened while it is written; v2 can.
  if (info.data.recording && info.data.format_version !== 2)
    return <Text color="text.muted">Still being recorded. It can be opened once the recording stops.</Text>;

  return (
    <VStack align="stretch" spacing={4}>
      <RecordingHeader info={info.data} />
      <Player key={info.data.name} info={info.data} deposition={deposition} />
      {info.data.format_version === 2 && (
        <Box>
          <SectionTitle>Saved with the recording</SectionTitle>
          <MetadataPanel info={info.data} />
        </Box>
      )}
    </VStack>
  );
};

/**
 * The RHEED recordings made while this sample was grown: scrub the frames,
 * and read the integration boxes' intensity -- the growth oscillations --
 * against the same clock. Clicking the curve jumps the frame to that moment.
 *
 * Which recordings belong to the sample comes from its journal: each
 * `start_storage` step names the file it opened.
 */
const RecordingViewer = ({ sampleId }: { sampleId: number }) => {
  const steps = useSampleSteps(sampleId);
  const recordings = useMemo(() => recordingsOf(steps.data?.steps ?? []), [steps.data]);
  const [picked, setPicked] = useState<string | null>(null);
  const name = recordings.some((r) => r.name === picked) ? picked : recordings[recordings.length - 1]?.name ?? null;
  const current = recordings.find((r) => r.name === name) ?? null;

  if (steps.isPending && steps.nodeUp) return <Spinner size="sm" />;
  if (steps.isError) return <Text color="status.error">{steps.error.message}</Text>;
  if (!recordings.length || !name)
    return <Text color="text.muted">No RHEED recording was made for this sample.</Text>;

  return (
    <VStack align="stretch" spacing={3}>
      {recordings.length > 1 && (
        <Select
          size="sm"
          aria-label="Recording"
          value={name}
          onChange={(e) => setPicked(e.target.value)}
          maxW="360px"
          borderRadius="md"
        >
          {recordings.map((r, i) => (
            <option key={r.name} value={r.name}>
              {recordingLabel(r, i)}
            </option>
          ))}
        </Select>
      )}
      <Text fontSize="xs" color="text.muted" fontFamily="mono" wordBreak="break-all">
        {name}
      </Text>
      <RecordingBody key={name} name={name} deposition={current?.deposition ?? null} />
    </VStack>
  );
};

export default RecordingViewer;
