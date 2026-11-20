import { useState } from "react";
import { Box, Text, useToast } from "@chakra-ui/react";

import { CurrentTask } from "../../generated/lumi";
import useDriverCall from "../../hooks/useDriverCall";
import ConfirmButton from "../Controller/ConfirmButton";

const TEMPERATURE_TASKS = new Set(["to_temperature", "cool_down", "anneal"]);

/**
 * Ends the running task, whatever it is (experiment.driver.cancel_task). A
 * heating task switches the PID off and holds the LD current; the reply,
 * what the chamber was left doing, also goes to a toast, since this button
 * unmounts with the task. Depositions use StopDepositionButton,
 * which also names the pulses kept.
 */
const CancelTaskButton = ({ task, label }: { task: CurrentTask; label: string }) => {
  const call = useDriverCall();
  const toast = useToast();
  const [chamber, setChamber] = useState<string | null>(null);

  return (
    <Box>
      <ConfirmButton
        size="xs"
        colorScheme="red"
        isDisabled={!call.canOperate}
        confirmLabel={`Stop the ${label.toLowerCase()} now?${
          TEMPERATURE_TASKS.has(task.kind) ? " PID goes off and the heater stays at its present current, so the temperature settles wherever that current puts it." : ""
        }`}
        onConfirm={() =>
          call
            .run((c) => c.cancel_task({ reason: "operator stop", task_id: task.id }))
            .then((r) => {
              if (!r) return;
              setChamber(r.chamber ?? null);
              // The bar this button sits in goes away with the task, so the
              // reply would vanish with it: say it where it stays a while.
              toast({
                title: `${label} stopped`,
                description: r.chamber || undefined,
                status: "info",
                duration: 8000,
                isClosable: true,
              });
            })
        }
      >
        Stop task
      </ConfirmButton>
      {chamber && (
        <Text fontSize="0.65rem" color="text.muted">
          {chamber}
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

export default CancelTaskButton;
