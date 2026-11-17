import { Badge, HStack, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import StopDepositionButton from "../ExperimentDriver/StopDepositionButton";
import { Field, Section } from "./primitives";
import { ConfirmOpButton, NumberOp, OpButton, SelectOp, SwitchOp, TwoNumberOp } from "./controlPrimitives";

const STOPPABLE_TASKS = new Set(["perform_deposition", "perform_preablation", "fire_laser_test"]);

const MODE_OPTIONS = [
  { value: "hv", label: "HV" },
  { value: "energy", label: "Energy" },
];

/**
 * The sample shutter and the PLC fire trigger, plus the excimer (COMPexPro)
 * itself. The excimer only accepts settings from whichever PC holds its
 * settings port (CM) -- `take_laser_control`/`release_laser` move that, and
 * every other excimer op below is refused without it, with the refusal shown
 * inline rather than gated client-side.
 *
 * `stop_fire` needs no control and works regardless of who holds it, so it is
 * a confirm button rather than following the rest of this panel's
 * role/control gating.
 */
const LaserControls = () => {
  const call = useChamberPldCall();
  const chamber = useChamberPldStore((s) => s.chamber);
  const laser = chamber?.laser;
  const excimer = chamber?.excimer;
  const task = useExperimentDriverNodeStore((s) => s.state.current_task);

  return (
    <Section title="Laser & excimer">
      <VStack align="stretch" spacing={2}>
        <Field label="Sample shutter away (open)">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(chamber?.sample_shutter_away)}
            op={(c, away) => c.set_sample_shutter({ in_front: !away })}
          />
        </Field>
        <Field label="Fire (pulses, rate Hz)">
          <TwoNumberOp
            call={call}
            labelA="Pulses"
            labelB="Rate"
            unitA="pulses"
            unitB="Hz"
            action="Fire"
            op={(c, pulses, rate_hz) => c.fire_laser({ pulses, rate_hz, wait: false })}
          />
        </Field>
        <Field label="Status">
          <HStack spacing={1} justify="flex-end">
            <Text fontSize="xs">
              {laser?.status ?? "—"} · {laser?.pulses_fired ?? 0}/{laser?.pulses_requested ?? 0} fired
              {laser?.status === "firing" && laser?.rate_hz != null && ` @ ${laser.rate_hz.toFixed(1)} Hz`}
            </Text>
            {laser?.stop_requested && (
              <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
                stop requested
              </Badge>
            )}
          </HStack>
        </Field>
        <Field label="STOP firing">
          <ConfirmOpButton
            call={call}
            colorScheme="red"
            confirmLabel="Stop the current pulse train now? Pulses already fired are kept."
            op={(c) => c.stop_fire()}
          >
            STOP
          </ConfirmOpButton>
        </Field>
        {task && STOPPABLE_TASKS.has(task.kind) && (
          <Field label={task.kind === "fire_laser_test" ? "Driver is firing the laser test" : "Driver is running a deposition"}>
            <StopDepositionButton task={task} />
          </Field>
        )}

        <VStack align="stretch" spacing="2px" pt={1} borderTopWidth="1px" borderColor="panel.border">
          <Text fontSize="xs" fontWeight="600" color="text.secondary">
            Excimer settings port (CM)
          </Text>
        </VStack>
        <Field label="This PC holds CM">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(excimer?.control)}
            op={(c, on) => (on ? c.take_laser_control() : c.release_laser())}
          />
        </Field>
        <Field label="Opmode">
          <Text fontSize="xs">
            {excimer?.opmode ?? "—"}
            {excimer?.waiting && " (switching, ~8s)"}
          </Text>
        </Field>
        <Field label="Excimer on/standby/off">
          <OpButton call={call} colorScheme="green" op={(c) => c.laser_on({ wait: false })}>
            ON
          </OpButton>
        </Field>
        <Field label=" ">
          <OpButton call={call} op={(c) => c.laser_standby()}>
            STANDBY
          </OpButton>
        </Field>
        <Field label=" ">
          <OpButton call={call} variant="outline" op={(c) => c.laser_off()}>
            OFF
          </OpButton>
        </Field>
        <Field label="Mode">
          <SelectOp
            call={call}
            label="Excimer mode"
            options={MODE_OPTIONS}
            action="Set"
            op={(c, mode) => c.set_laser_mode({ mode: mode as "hv" | "energy" })}
          />
        </Field>
        <Field label={`HV (${excimer?.hv_min ?? 18.5}–${excimer?.hv_max ?? 25.5} kV)`}>
          <NumberOp call={call} label="HV" unit="kV" action="Set" step={0.1} op={(c, kv) => c.set_laser_hv({ kv })} />
        </Field>
        <Field label={`Energy (${excimer?.energy_min ?? 100}–${excimer?.energy_max ?? 400} mJ)`}>
          <NumberOp
            call={call}
            label="Energy"
            unit="mJ"
            action="Set"
            step={1}
            op={(c, mj) => c.set_laser_energy({ mj })}
          />
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

export default LaserControls;
