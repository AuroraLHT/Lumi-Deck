import { Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field, Section } from "./primitives";
import { NumberOp, OpButton, SwitchOp, TwoNumberOp } from "./controlPrimitives";

/**
 * LD heater: key/start/threshold must be switched on in that order (the
 * service refuses `start` before `key`, and the PLD controller refuses
 * `threshold` before `start`), then either the temperature PID or a manual
 * current. `set_temperature` is sent with `wait: false` -- waited, it can
 * block for up to four hours, and the heater section of the state stream
 * already shows the setpoint converging.
 */
const HeaterControls = () => {
  const call = useChamberPldCall();
  const heater = useChamberPldStore((s) => s.chamber?.heater);

  return (
    <Section title="Heater">
      <VStack align="stretch" spacing={2}>
        <Field label="Key">
          <SwitchOp call={call} label="" checked={Boolean(heater?.key_on)} op={(c, on) => c.set_heater_key({ on })} />
        </Field>
        <Field label="Start">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(heater?.start_on)}
            op={(c, on) => c.set_heater_start({ on })}
          />
        </Field>
        <Field label="Threshold">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(heater?.threshold_on)}
            op={(c, on) => c.set_heater_threshold({ on })}
          />
        </Field>
        <Field label="Temperature PID">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(heater?.pid_on)}
            op={(c, on) => c.set_temperature_control({ on })}
          />
        </Field>
        <Field label="Manual current (A)">
          <NumberOp
            call={call}
            label="Manual current"
            unit="A"
            action="Set"
            step={0.1}
            op={(c, amps) => c.set_heating_current({ amps })}
          />
        </Field>
        <Field label="Current limits (A)">
          <TwoNumberOp
            call={call}
            labelA="Min current"
            labelB="Max current"
            unitA="min A"
            unitB="max A"
            action="Set"
            op={(c, min_amps, max_amps) => c.set_heater_current_limits({ min_amps, max_amps })}
          />
        </Field>
        <Field label="Target temperature">
          <TwoNumberOp
            call={call}
            labelA="Target temperature"
            labelB="Ramp"
            unitA="°C"
            unitB="°C/min, 0=jump"
            initialB="0"
            action="Set"
            op={(c, celsius, ramp_c_per_min) => c.set_temperature({ celsius, ramp_c_per_min, wait: false })}
          />
        </Field>
        <Field label="Auto-tune PID">
          <OpButton call={call} op={(c) => c.tune_heater({ on: true })}>
            Start
          </OpButton>
        </Field>
        <Field label="Cancel auto-tune">
          <OpButton call={call} variant="outline" op={(c) => c.tune_heater({ on: false })}>
            Cancel
          </OpButton>
        </Field>

        {call.error && (
          <Text fontSize="xs" color="status.error">
            {call.error}
          </Text>
        )}
      </VStack>
    </Section>
  );
};

export default HeaterControls;
