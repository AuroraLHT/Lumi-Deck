import { FormEvent, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  HStack,
  Input,
  InputGroup,
  InputLeftAddon,
  InputRightAddon,
  Text,
  VStack,
} from "@chakra-ui/react";

import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverStore from "../../stores/experimentDriver";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import MaskScanChart from "./MaskScanChart";
import { AUTO_ALIGN_KIND, isMaskAlignResult } from "./maskAlign";
import Section from "./Section";

const DEFAULT_HALF_WINDOW_MM = 4;
/** Below this, a result and the calibration are the same number as far as anyone cares. */
const SAME_MM = 0.0005;

const mm = (value: number) => `${value.toFixed(3)} mm`;

/**
 * Starts `auto_align_center_mask` and shows how the last one went.
 *
 * Exposed: where the scan is centred (`center_mm`, blank = the current
 * calibration) and how wide it is. The backend's other parameters are tuned
 * defaults. "Auto apply" maps to the op's `apply`; off, the scan only
 * reports, and the result carries an "Apply" button that stores it with
 * `set_center_mask_pos` -- which moves nothing, so keeping a result is
 * never a hardware action.
 *
 * The run itself is watched through the driver state, not from here: while
 * it waits for a `mask-center` marker it is a pending confirmation, which the
 * panel's prompt card handles, and its result arrives on the stream whether
 * or not this card was the one that started it.
 */
const MaskAutoAlign = ({ locked }: { locked: boolean }) => {
  const { run, busy, error, canOperate } = useDriverCall();
  const applyCall = useDriverCall();
  const task = useExperimentDriverNodeStore((s) => s.state.current_task);
  const calibration = useExperimentDriverNodeStore((s) => s.state.center_mask_pos);
  const results = useExperimentDriverStore((s) => s.results);

  const [scanAround, setScanAround] = useState("");
  const [halfWindow, setHalfWindow] = useState(String(DEFAULT_HALF_WINDOW_MM));
  const [autoApply, setAutoApply] = useState(true);

  const running = task?.kind === AUTO_ALIGN_KIND;
  const last = [...results].reverse().find((r) => r.kind === AUTO_ALIGN_KIND);
  const aligned = last && isMaskAlignResult(last.data) ? last.data : null;

  const halfWindowMm = Number(halfWindow);
  const validWindow = Number.isFinite(halfWindowMm) && halfWindowMm > 0 && halfWindowMm <= 30;
  const centerMm = scanAround.trim() === "" ? null : Number(scanAround);
  const validCenter = centerMm === null || (Number.isFinite(centerMm) && centerMm >= 0);
  const scanCenter = centerMm ?? calibration;
  const valid = validWindow && validCenter;

  const start = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    run((client) =>
      client.auto_align_center_mask({
        half_window_mm: halfWindowMm,
        apply: autoApply,
        ...(centerMm !== null ? { center_mm: centerMm } : {}),
      })
    );
  };

  // Offered on any successful result the calibration does not already hold --
  // a report-only run, or an applied one someone has since overridden.
  const canApplyResult =
    aligned !== null && (calibration === null || Math.abs(aligned.center - calibration) > SAME_MM);

  return (
    <Section title="Mask center auto-align">
      <VStack as="form" align="stretch" spacing={2} onSubmit={start}>
        <Text fontSize="xs" color="text.muted">
          Scans Mask1 while watching the marker tagged <b>mask-center</b> on the chamber
          camera, then centers the slit on it.
        </Text>
        <HStack spacing={2} flexWrap="wrap" rowGap={2}>
          <InputGroup size="xs" w="170px">
            <InputLeftAddon>Around</InputLeftAddon>
            <Input
              type="number"
              step="0.5"
              min="0"
              aria-label="Scan around"
              placeholder={calibration != null ? calibration.toFixed(3) : "calibration"}
              title="Where the scan is centered. Blank: the current calibration."
              value={scanAround}
              onChange={(e) => setScanAround(e.target.value)}
              isInvalid={!validCenter}
            />
          </InputGroup>
          <InputGroup size="xs" w="120px">
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="30"
              aria-label="Scan half-width"
              value={halfWindow}
              onChange={(e) => setHalfWindow(e.target.value)}
              isInvalid={!validWindow}
            />
            <InputRightAddon>± mm</InputRightAddon>
          </InputGroup>
        </HStack>
        <HStack spacing={2} flexWrap="wrap" rowGap={2}>
          <Checkbox
            size="sm"
            isChecked={autoApply}
            onChange={(e) => setAutoApply(e.target.checked)}
          >
            <Text fontSize="xs">Auto apply</Text>
          </Checkbox>
          <Button
            type="submit"
            size="xs"
            colorScheme="blue"
            isLoading={busy}
            isDisabled={!canOperate || locked || !valid}
            title={
              !canOperate
                ? "Operator access required"
                : locked
                ? "The driver is busy -- finish or cancel what it is doing first"
                : undefined
            }
          >
            {running ? "Aligning…" : "Start alignment"}
          </Button>
        </HStack>
        <Text fontSize="xs" color="text.muted">
          Calibration {calibration != null ? mm(calibration) : "unknown"}
          {scanCenter != null && validWindow && (
            <>
              {" · "}scans {(scanCenter - halfWindowMm).toFixed(2)} to{" "}
              {(scanCenter + halfWindowMm).toFixed(2)} mm
            </>
          )}
        </Text>
        {error && (
          <Text fontSize="xs" color="status.error">
            {error}
          </Text>
        )}

        {last && !running && (
          <VStack align="stretch" spacing={1} pt={1}>
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
        )}
      </VStack>
    </Section>
  );
};

export default MaskAutoAlign;
