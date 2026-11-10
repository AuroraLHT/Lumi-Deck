import { useState } from "react";
import { Box, Text } from "@chakra-ui/react";

import { CurrentTask } from "../../generated/lumi";
import useDriverCall from "../../hooks/useDriverCall";
import ConfirmButton from "../Controller/ConfirmButton";

/**
 * Ends the running perform_deposition/perform_preablation task and stops the
 * laser in one op (experiment.driver.stop_deposition) -- the shutter, mask,
 * target spin and logging are left exactly as they are; a stopped
 * pre-ablation leaves the mask at its block position. Shown wherever the
 * driver's current task is visible: this panel, and the chamber.pld Controls
 * panel's low-level STOP, which only stops the laser and does not touch the
 * driver's own task.
 */
const StopDepositionButton = ({ task }: { task: CurrentTask }) => {
  const call = useDriverCall();
  const [result, setResult] = useState<{ laser: string } | null>(null);

  return (
    <Box>
      <ConfirmButton
        size="xs"
        colorScheme="red"
        isDisabled={!call.canOperate}
        confirmLabel={`Stop this ${
          task.kind === "perform_preablation" ? "pre-ablation" : "deposition"
        } now? Pulses already fired are kept.`}
        onConfirm={() =>
          call.run((c) => c.stop_deposition({ reason: "operator stop" })).then((r) => setResult(r ?? null))
        }
      >
        Stop deposition
      </ConfirmButton>
      {result && (
        <Text fontSize="0.65rem" color="text.muted">
          laser: {result.laser}
        </Text>
      )}
      {call.error && (
        <Text fontSize="0.65rem" color="status.error">
          {call.error}
        </Text>
      )}
    </Box>
  );
};

export default StopDepositionButton;
