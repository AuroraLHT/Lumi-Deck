import { Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field, Section, sortedEntries } from "./primitives";
import { ConfirmOpButton, OpButton, SwitchOp } from "./controlPrimitives";

type PumpName = "TMP1" | "TMP20" | "TMP21" | "TMP3" | "DP1" | "DP2" | "DP3";

/**
 * The load lock's Auto Vent/Auto Vac sequences and the pumps. `cancel_load_lock`
 * needs no control (same as `stop_fire`) and stops whichever sequence is
 * running, hence the confirm.
 */
const LoadLockPumpControls = () => {
  const call = useChamberPldCall();
  const chamber = useChamberPldStore((s) => s.chamber);
  const loadLock = chamber?.load_lock;
  const pumps = sortedEntries(chamber?.pumps);

  return (
    <Section title="Load lock & pumps">
      <VStack align="stretch" spacing={2}>
        <Field label="Sequence">
          <Text fontSize="xs">
            {loadLock?.sequence || "idle"}
            {loadLock?.step ? ` · ${loadLock.step}` : ""}
          </Text>
        </Field>
        <Field label="Auto Vent">
          <OpButton call={call} colorScheme="blue" op={(c) => c.auto_vent()}>
            Start
          </OpButton>
        </Field>
        <Field label="Auto Vac">
          <OpButton call={call} colorScheme="blue" op={(c) => c.auto_vac()}>
            Start
          </OpButton>
        </Field>
        <Field label="Cancel running sequence">
          <ConfirmOpButton
            call={call}
            confirmLabel="Stop the running Auto Vent / Auto Vac sequence?"
            op={(c) => c.cancel_load_lock()}
          >
            Cancel
          </ConfirmOpButton>
        </Field>

        {pumps.length > 0 && (
          <VStack align="stretch" spacing="2px" pt={1} borderTopWidth="1px" borderColor="panel.border">
            <Text fontSize="xs" fontWeight="600" color="text.secondary">
              Pumps
            </Text>
            {pumps.map(([name, pump]) => (
              <SwitchOp
                key={name}
                call={call}
                label={name}
                checked={Boolean(pump.running)}
                op={(c, on) => c.set_pump({ pump: name as PumpName, on })}
              />
            ))}
          </VStack>
        )}

        {call.error && (
          <Text fontSize="xs" color="status.error">
            {call.error}
          </Text>
        )}
      </VStack>
    </Section>
  );
};

export default LoadLockPumpControls;
