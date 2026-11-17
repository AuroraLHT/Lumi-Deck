import { useState } from "react";
import { Box, Text } from "@chakra-ui/react";

import { CurrentTask } from "../../generated/lumi";
import useDriverCall from "../../hooks/useDriverCall";
import ConfirmButton from "../Controller/ConfirmButton";

/**
 * Ends the running perform_deposition/perform_preablation/fire_laser_test task and stops the
 * laser in one op (experiment.driver.stop_deposition) -- the shutter, mask,
 * target spin and logging are left exactly as they are; a stopped
 * pre-ablation leaves the mask at its block position. Shown wherever the
 * driver's current task is visible: this panel, and the chamber.pld Controls
 * panel's low-level STOP, which only stops the laser and does not touch the
 * driver's own task.
 */
const WHAT: Record<string, string> = {
  perform_preablation: "pre-ablation",
  fire_laser_test: "laser test firing",
};

const StopDepositionButton = ({ task }: { task: CurrentTask }) => {
  const call = useDriverCall();
  const what = WHAT[task.kind] ?? "deposition";
  const [result, setResult] = useState<{ laser: string } | null>(null);

  return (
    <Box>
      <ConfirmButton
        size="xs"
        colorScheme="red"
        isDisabled={!call.canOperate}
        confirmLabel={`Stop this ${what} now? Pulses already fired are kept.`}
        onConfirm={() =>
          call.run((c) => c.stop_deposition({ reason: "operator stop" })).then((r) => setResult(r ?? null))
        }
      >
        {task.kind === "fire_laser_test" ? "Stop firing" : "Stop deposition"}
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
