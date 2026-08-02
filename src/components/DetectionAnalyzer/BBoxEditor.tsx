import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormLabel,
  Grid,
  Input,
  SimpleGrid,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { RiEditBoxLine } from "react-icons/ri";

import useLiveAnalysisStore, { SelectedDetection } from "../../stores/liveAnalysis";
import useRheedNodeStore from "../../stores/nodes/rheed";
import useAnalyzerControl from "../../hooks/useAnalyzerControl";

/** The four editable numbers, as typed. Strings so a half-typed value survives. */
interface Draft {
  x: string;
  y: string;
  w: string;
  h: string;
}

/** Corner form `[x1, y1, x2, y2]` -> the origin+extent the user reasons about. */
const toDraft = (bbox: number[]): Draft => ({
  x: String(Math.round(bbox[0])),
  y: String(Math.round(bbox[1])),
  w: String(Math.round(bbox[2] - bbox[0])),
  h: String(Math.round(bbox[3] - bbox[1])),
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface Props {
  detection: SelectedDetection;
}

/**
 * The focused box's numbers, editable.
 *
 * Two ways to move a box, because they suit different jobs: drag it on the video
 * when you are matching a feature by eye, or type the coordinates when you are
 * reproducing a region from a previous run or nudging it by exactly one pixel.
 * Both end at the same place -- `setDetectionBBox` followed by
 * `applyGeometryChange`, so whichever analyses are running pick the change up.
 *
 * Kept behind the collapsed "Box details" section: it is reference data and an
 * occasional edit, and it was previously eating half the analyzer panel to show
 * eight read-only numbers.
 */
const BBoxEditor = ({ detection }: Props) => {
  const setDetectionBBox = useLiveAnalysisStore((s) => s.setDetectionBBox);
  const beginRedraw = useLiveAnalysisStore((s) => s.beginRedraw);
  const redrawTargetID = useLiveAnalysisStore((s) => s.redrawTargetID);
  const { applyGeometryChange } = useAnalyzerControl();
  const frameDims = useRheedNodeStore((s) => s.state.frame_dims);

  const [draft, setDraft] = useState<Draft>(() => toDraft(detection.bbox));
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever the box being edited changes underneath us -- a different
  // box focused, or this one moved by a redraw. Keyed on the values rather than
  // the array so the heartbeat's re-renders do not clobber a half-typed edit.
  const bboxKey = detection.bbox.join(",");
  useEffect(() => {
    setDraft(toDraft(detection.bbox));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection.id, bboxKey]);

  // frame_dims is [height, width], and is [0, 0] until the RHEED node's first
  // heartbeat -- clamping to that would collapse every box to a point.
  const [frameHeight, frameWidth] = frameDims;
  const hasFrame = frameHeight > 0 && frameWidth > 0;

  const isDirty = ["x", "y", "w", "h"].some(
    (k) => draft[k as keyof Draft] !== toDraft(detection.bbox)[k as keyof Draft]
  );

  const handleApply = () => {
    const values = {
      x: Number(draft.x),
      y: Number(draft.y),
      w: Number(draft.w),
      h: Number(draft.h),
    };

    if (Object.values(values).some((v) => !Number.isFinite(v))) {
      setError("All four fields must be numbers.");
      return;
    }
    if (values.w < 1 || values.h < 1) {
      setError("Width and height must be at least 1px.");
      return;
    }

    const maxX = hasFrame ? frameWidth - 1 : Number.MAX_SAFE_INTEGER;
    const maxY = hasFrame ? frameHeight - 1 : Number.MAX_SAFE_INTEGER;
    const x = clamp(Math.round(values.x), 0, maxX);
    const y = clamp(Math.round(values.y), 0, maxY);
    // Extents are clamped against the *clamped* origin, so a box pushed off the
    // right edge shrinks to fit rather than wrapping to a negative width.
    const w = clamp(Math.round(values.w), 1, hasFrame ? frameWidth - x : values.w);
    const h = clamp(Math.round(values.h), 1, hasFrame ? frameHeight - y : values.h);

    setError(null);
    setDetectionBBox(detection.id, [x, y, x + w, y + h]);
    const updated =
      useLiveAnalysisStore.getState().selectedDetection[detection.id];
    if (updated) applyGeometryChange(updated);
  };

  const field = (key: keyof Draft, label: string) => (
    <Box>
      <FormLabel
        htmlFor={`bbox-${key}`}
        fontSize="10px"
        mb={0.5}
        color="text.secondary"
        textTransform="uppercase"
        letterSpacing="0.05em"
      >
        {label}
      </FormLabel>
      <Input
        id={`bbox-${key}`}
        size="xs"
        type="number"
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleApply();
        }}
        borderColor="panel.border"
      />
    </Box>
  );

  return (
    <Box
      bg="panel.bgElevated"
      borderWidth="1px"
      borderColor="panel.border"
      borderRadius="md"
      p={2.5}
    >
      <SimpleGrid columns={4} spacing={2} mb={2}>
        {field("x", "X")}
        {field("y", "Y")}
        {field("w", "W")}
        {field("h", "H")}
      </SimpleGrid>

      <Flex gap={2} mb={2}>
        <Button
          size="xs"
          colorScheme="blue"
          flex="1"
          onClick={handleApply}
          isDisabled={!isDirty}
        >
          Apply
        </Button>
        <Tooltip
          label="Drag a new rectangle on the RHEED video to move this box"
          openDelay={400}
        >
          <Button
            size="xs"
            flex="1"
            variant="outline"
            leftIcon={<RiEditBoxLine />}
            colorScheme={redrawTargetID === detection.id ? "blue" : undefined}
            onClick={() => beginRedraw(detection.id)}
          >
            {redrawTargetID === detection.id ? "Drawing…" : "Redraw"}
          </Button>
        </Tooltip>
      </Flex>

      {error && (
        <Text fontSize="xs" color="red.400" mb={1}>
          {error}
        </Text>
      )}

      <Grid
        templateColumns="repeat(2, minmax(0, 1fr))"
        gap={1}
        fontSize="xs"
        color="text.secondary"
      >
        <Text>
          Label <Text as="span" color="text.primary">{detection.label}</Text>
        </Text>
        <Text>
          Score{" "}
          <Text as="span" color="text.primary">
            {detection.score.toFixed(2)}
          </Text>
        </Text>
      </Grid>
    </Box>
  );
};

export default BBoxEditor;
