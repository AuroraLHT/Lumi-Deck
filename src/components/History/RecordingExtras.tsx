import { useMemo } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";

import {
  RecordedBox,
  RecordedCrop,
  RecordingDetections,
  RecordingEvent,
  RecordingInfo,
  StepInfo,
} from "../../generated/lumi";
import RecordingTimeChart from "./RecordingTimeChart";
import { formatTime } from "./history";

/**
 * The detector's boxes for one frame, over it. Boxes come in the detector's
 * crop; the crop's corner puts them back on the frame. Drawn as the live view
 * draws them.
 */
export const DetectionOverlay = ({
  boxes,
  crop,
  shape,
}: {
  boxes: RecordedBox[];
  crop: RecordedCrop | null | undefined;
  shape: number[];
}) => {
  const [height, width] = shape;
  const dx = crop?.x ?? 0;
  const dy = crop?.y ?? 0;
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
      {boxes.map((b) => (
        <rect
          key={b.bbox_id}
          x={b.x0 + dx}
          y={b.y0 + dy}
          width={b.x1 - b.x0}
          height={b.y1 - b.y0}
          fill="none"
          stroke="purple"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </Box>
  );
};

/** The classifier's score for each class over the recording, 0 to 1. */
export const DetectionChart = ({
  detections,
  t0,
  cursor,
  deposition,
  onSeek,
}: {
  detections: RecordingDetections;
  t0: number;
  cursor: number | null;
  deposition: StepInfo | null;
  onSeek: (time: number) => void;
}) => {
  const lines = useMemo(
    () =>
      Object.entries(detections.classification ?? {}).map(([cls, values]) => ({
        id: cls,
        time: detections.time ?? [],
        values,
      })),
    [detections]
  );
  if (!lines.length) return null;
  return (
    <RecordingTimeChart
      lines={lines}
      t0={t0}
      cursor={cursor}
      deposition={deposition}
      onSeek={onSeek}
      yLegend="Class score"
      yRange={[0, 1]}
      digits={2}
      what="classes"
      height={{ base: "180px", xl: "220px" }}
    />
  );
};

const EVENT_SCHEME = (kind: string) =>
  kind === "note"
    ? "blue"
    : kind.startsWith("task_")
    ? "green"
    : kind.startsWith("chamber.")
    ? "orange"
    : kind === "dropped"
    ? "red"
    : kind.startsWith("recording_")
    ? "gray"
    : "purple";

/** What happened while the file was open, oldest first. A row moves the frame there. */
export const EventList = ({
  events,
  t0,
  onSeek,
}: {
  events: RecordingEvent[];
  t0: number;
  onSeek: (time: number) => void;
}) => (
  <VStack align="stretch" spacing={0} maxH="260px" overflowY="auto" borderWidth="1px" borderColor="panel.border" borderRadius="md">
    {events.map((e, i) => (
      <HStack
        key={`${e.time}-${i}`}
        as="button"
        type="button"
        spacing={2}
        px={2}
        py={1}
        fontSize="xs"
        textAlign="left"
        _hover={{ bg: "accent.subtle" }}
        onClick={() => onSeek(e.time)}
        title={`${formatTime(e.time)}${e.detail && Object.keys(e.detail).length ? `\n${JSON.stringify(e.detail)}` : ""}`}
      >
        <Text fontFamily="mono" color="text.muted" minW="56px" flexShrink={0}>
          {e.time < t0 ? "−" : "+"}
          {Math.abs(e.time - t0).toFixed(1)} s
        </Text>
        <Badge colorScheme={EVENT_SCHEME(e.kind)} fontSize="0.6rem" textTransform="none" flexShrink={0}>
          {e.kind}
        </Badge>
        <Text noOfLines={1}>{e.message}</Text>
      </HStack>
    ))}
  </VStack>
);

/** Which source each `meta` snapshot came from, in reading order. */
const META_LABELS: Record<string, string> = {
  request: "Recording request",
  experiment: "Experiment context",
  chamber: "Chamber state",
  camera: "Camera",
  log: "Chamber log",
  integrator: "Integration boxes",
  detection: "Detector",
};

/**
 * Everything the file says about itself: the snapshot of each node taken when
 * recording started, and the file's own attributes (format, software, counts).
 * Shown as stored -- the point is to see exactly what a notebook will read.
 */
export const MetadataPanel = ({ info }: { info: RecordingInfo }) => {
  const meta = info.meta ?? {};
  const sections = [
    ...Object.keys(META_LABELS).filter((k) => k in meta),
    ...Object.keys(meta).filter((k) => !(k in META_LABELS)),
  ].map((k) => ({ key: k, label: META_LABELS[k] ?? k, value: meta[k] }));
  if (info.attrs) sections.push({ key: "attrs", label: "File attributes", value: info.attrs });
  if (!sections.length) return null;

  return (
    <Accordion allowMultiple>
      {sections.map(({ key, label, value }) => (
        <AccordionItem key={key} borderColor="panel.border">
          <AccordionButton px={2} py={1.5}>
            <Text flex={1} textAlign="left" fontSize="xs" fontWeight="600">
              {label}
            </Text>
            <Text fontSize="xs" color="text.muted" fontFamily="mono" mr={2}>
              {key === "attrs" ? "/" : `/meta/${key}`}
            </Text>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel px={2} pb={2}>
            <Box
              as="pre"
              fontSize="0.7rem"
              fontFamily="mono"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              maxH="320px"
              overflowY="auto"
              bg="panel.header"
              p={2}
              borderRadius="md"
            >
              {JSON.stringify(value, null, 2)}
            </Box>
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

/** A section title over a chart or list, with a spinner while it loads. */
export const SectionTitle = ({ children, loading }: { children: React.ReactNode; loading?: boolean }) => (
  <HStack spacing={2} mb={1}>
    <Text fontSize="sm" fontWeight="600">
      {children}
    </Text>
    {loading && <Spinner size="xs" />}
  </HStack>
);
