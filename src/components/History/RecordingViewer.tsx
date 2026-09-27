import { useEffect, useMemo, useState } from "react";
import {
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
  VStack,
} from "@chakra-ui/react";
import { LuChevronLeft, LuChevronRight, LuPause, LuPlay } from "react-icons/lu";

import { IntegrationBox, RecordingInfo } from "../../generated/lumi";
import {
  useRecordingFrame,
  useRecordingInfo,
  useRecordingIntegration,
  useSampleSteps,
} from "../../hooks/useHistory";
import useSeriesPalette, { MAX_SERIES } from "../Plotting/seriesPalette";
import IntegrationChart from "./IntegrationChart";
import { formatDuration, formatTime, nearestFrame, recordingsOf, SampleRecording } from "./history";

/** Playback speed: frames shown per second, whatever the recording's own rate was. */
const PLAY_FPS = 6;

const recordingLabel = (r: SampleRecording, i: number) => {
  const material = r.deposition?.params?.target_material;
  return `${i + 1}. ${typeof material === "string" ? material : "Recording"} · ${formatTime(r.startedAt)}`;
};

/** The integration boxes drawn over the frame, in the chart's series colours. */
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

  const frame = useRecordingFrame(nFrames ? info.name : null, index);
  const integration = useRecordingIntegration(info.n_integrations ? info.name : null);

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
          {info.boxes && <BoxOverlay boxes={info.boxes} shape={shape} />}
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
          <Text fontSize="xs" color="text.secondary" fontFamily="mono" minW="120px" textAlign="right">
            {index + 1}/{nFrames} · +{formatDuration(frameTime != null ? frameTime - t0 : null) || "0s"}
          </Text>
        </HStack>
        {frame.data && (
          <Text fontSize="xs" color="text.muted" textAlign="center">
            {formatTime(frameTime)} · contrast {Math.round(frame.data.low)}–{Math.round(frame.data.high)}{" "}
            (fixed for the whole recording)
          </Text>
        )}

      </VStack>

      <Box>
        <Text fontSize="sm" fontWeight="600" mb={1}>
          Integrated intensity
        </Text>
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
            onSeek={(time) => {
              setPlaying(false);
              setIndex(nearestFrame(frameTimes, time));
            }}
          />
        )}
      </Box>
    </Grid>
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

  const info = useRecordingInfo(name);

  if (steps.isPending && steps.nodeUp) return <Spinner size="sm" />;
  if (steps.isError) return <Text color="status.error">{steps.error.message}</Text>;
  if (!recordings.length)
    return <Text color="text.muted">No RHEED recording was made for this sample.</Text>;

  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={3} flexWrap="wrap" rowGap={2}>
        {recordings.length > 1 && (
          <Select
            size="sm"
            aria-label="Recording"
            value={name ?? ""}
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
        {info.data && (
          <Text fontSize="xs" color="text.muted">
            {info.data.n_frames ?? 0} frames · {formatDuration((info.data.end ?? 0) - (info.data.start ?? 0))} ·{" "}
            {((info.data.size_bytes ?? 0) / 1e6).toFixed(0)} MB
          </Text>
        )}
      </HStack>
      <Text fontSize="xs" color="text.muted" fontFamily="mono" wordBreak="break-all">
        {name}
      </Text>

      {!info.nodeUp ? (
        <Text color="text.muted">The storage node is not running, so recordings cannot be read.</Text>
      ) : info.isPending ? (
        <Spinner size="sm" />
      ) : info.isError ? (
        <Text color="status.error">{info.error.message}</Text>
      ) : info.data.recording ? (
        <Text color="text.muted">Still being recorded. It can be opened once the recording stops.</Text>
      ) : info.data.error ? (
        <Text color="status.error">This file cannot be read: {info.data.error}</Text>
      ) : (
        <Player key={info.data.name} info={info.data} deposition={current?.deposition ?? null} />
      )}
    </VStack>
  );
};

export default RecordingViewer;
