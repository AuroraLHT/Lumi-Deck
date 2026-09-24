import { useState } from "react";
import { Button, SimpleGrid, Text } from "@chakra-ui/react";

import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverStore from "../../stores/experimentDriver";
import Section from "./Section";

/**
 * Starts the driver's operator-in-the-loop checks. Each one opens a pending
 * confirmation, which the prompt card above then answers -- these buttons only
 * begin a flow, they never finish one.
 *
 * Disabled while the driver is busy (`locked`): the backend holds one pending
 * confirmation at a time and a new `begin_*` replaces the old one outright,
 * which would strand whatever flow was waiting on it.
 */
const CalibrationActions = ({ locked }: { locked: boolean }) => {
  const { run, busy, error, canOperate } = useDriverCall();
  const setPixelStatus = useExperimentDriverStore((s) => s.setPixelStatus);
  // A check with nothing to check opens no prompt at all, so without this the
  // button would look dead.
  const [note, setNote] = useState<string | null>(null);
  const disabled = !canOperate || locked;
  const title = !canOperate
    ? "Operator access required"
    : locked
    ? "The driver is busy -- finish or cancel what it is doing first"
    : undefined;

  return (
    <Section title="Operator checks">
      <SimpleGrid columns={2} spacing={2}>
        <Button
          size="xs"
          isDisabled={disabled}
          isLoading={busy}
          title={title}
          onClick={() => run((c) => c.begin_check_mask_center())}
        >
          Check mask center
        </Button>
        <Button
          size="xs"
          isDisabled={disabled}
          isLoading={busy}
          title={title}
          onClick={() => run((c) => c.begin_align_center_mask())}
        >
          Align mask by hand
        </Button>
        <Button
          size="xs"
          isDisabled={disabled}
          isLoading={busy}
          title={title}
          onClick={() => run((c) => c.begin_adjust_rheed_gain())}
        >
          Tune RHEED gain
        </Button>
        <Button
          size="xs"
          isDisabled={disabled}
          isLoading={busy}
          title={title}
          onClick={() =>
            run((c) => c.begin_check_rheed_pixels()).then((status) => {
              if (!status) return;
              setPixelStatus(status);
              setNote(status.done ? "No substrate positions to check -- register or resume a substrate first." : null);
            })
          }
        >
          Check RHEED pixels
        </Button>
      </SimpleGrid>
      {note && !error && (
        <Text fontSize="xs" color="text.muted" mt={2}>
          {note}
        </Text>
      )}
      {error && (
        <Text fontSize="xs" color="status.error" mt={2}>
          {error}
        </Text>
      )}
    </Section>
  );
};

export default CalibrationActions;
