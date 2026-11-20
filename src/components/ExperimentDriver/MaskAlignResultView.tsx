import { Badge, Button, HStack, Text, VStack } from "@chakra-ui/react";

import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverStore from "../../stores/experimentDriver";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import MaskScanChart from "./MaskScanChart";
import { AUTO_ALIGN_KIND, isMaskAlignResult } from "./maskAlign";

/** Below this, a result and the calibration are the same number as far as anyone cares. */
const SAME_MM = 0.0005;

const mm = (value: number) => `${value.toFixed(3)} mm`;

/**
 * How the last `auto_align_center_mask` went, under its card in the
 * operation console (which starts it like any other op).
 *
 * A report-only run (Auto apply off), or an applied one someone has since
 * overridden, carries an "Apply" button that stores the result with
 * `set_center_mask_pos` -- which moves nothing, so keeping a result is never
 * a hardware action.
 *
 * The result arrives on the driver's stream whether or not this console was
 * the one that started the run.
 */
const MaskAlignResultView = () => {
  const applyCall = useDriverCall();
  const task = useExperimentDriverNodeStore((s) => s.state.current_task);
  const calibration = useExperimentDriverNodeStore((s) => s.state.center_mask_pos);
  const results = useExperimentDriverStore((s) => s.results);
  const canOperate = applyCall.canOperate;

  const running = task?.kind === AUTO_ALIGN_KIND;
  const last = [...results].reverse().find((r) => r.kind === AUTO_ALIGN_KIND);
  const aligned = last && isMaskAlignResult(last.data) ? last.data : null;
  if (!last || running) return null;

  const canApplyResult =
    aligned !== null && (calibration === null || Math.abs(aligned.center - calibration) > SAME_MM);

  return (
    <VStack align="stretch" spacing={1}>
      <HStack spacing={2} fontSize="xs" flexWrap="wrap">
        <Badge colorScheme={last.ok ? (aligned?.converged ? "green" : "yellow") : "red"}>
          {last.ok ? (aligned?.converged ? "Converged" : "Not converged") : "Failed"}
        </Badge>
        <Text color="text.muted">{new Date(last.finishedAt).toLocaleTimeString()}</Text>
      </HStack>

      {!last.ok && (
        <Text fontSize="xs" color="status.error">
          {last.error}
        </Text>
      )}

      {aligned && (
        <>
          <Text fontSize="xs">
            Center <b>{mm(aligned.center)}</b>{" "}
            <Text as="span" color="text.muted">
              (was {mm(aligned.previous_center)},{" "}
              {aligned.center - aligned.previous_center >= 0 ? "+" : ""}
              {(aligned.center - aligned.previous_center).toFixed(3)})
            </Text>{" "}
            {!canApplyResult
              ? "-- the current calibration"
              : aligned.applied
              ? "-- applied, since changed"
              : "-- not applied"}
          </Text>
          {canApplyResult && (
            <HStack>
              <Button
                size="xs"
                colorScheme="green"
                isLoading={applyCall.busy}
                isDisabled={!canOperate}
                title="Store this as the mask calibration. Moves nothing."
                onClick={() =>
                  applyCall.run((c) => c.set_center_mask_pos({ position: aligned.center }))
                }
              >
                Apply {mm(aligned.center)}
              </Button>
            </HStack>
          )}
          {applyCall.error && (
            <Text fontSize="xs" color="status.error">
              {applyCall.error}
            </Text>
          )}
          <Text fontSize="xs" color="text.muted">
            Marker {aligned.marker_id} · contrast {aligned.contrast.toFixed(1)} · slit reads{" "}
            {aligned.polarity > 0 ? "brighter" : "darker"} than the plate
          </Text>
          <MaskScanChart result={aligned} />
          {(aligned.passes ?? []).map((p, i) => (
            <Text key={i} fontSize="xs" color="text.muted">
              {i === 0 ? "Wide scan" : `Pass ${i + 1}`}: {p.start.toFixed(2)} to{" "}
              {p.stop.toFixed(2)} mm, step {p.step.toFixed(3)} → center{" "}
              {p.center.toFixed(3)}, width {p.width.toFixed(3)}
            </Text>
          ))}
        </>
      )}
    </VStack>
  );
};

export default MaskAlignResultView;
