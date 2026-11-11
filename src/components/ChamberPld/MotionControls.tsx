import { HStack, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field, Section, sortedEntries } from "./primitives";
import { NumberOp, OpButton, SelectOp, SwitchOp } from "./controlPrimitives";

const TARGET_OPTIONS = ["A", "B", "C", "D", "E", "F", "Clear"].map((t) => ({ value: t, label: t }));
const AXIS_OPTIONS = [
  { value: "TG", label: "Target carousel" },
  { value: "Mask1", label: "Mask" },
  { value: "RHEED gun X", label: "RHEED gun X" },
];

/**
 * Carousel, mask, sample and RHEED gun motion, plus the valves. Moves are
 * sent with `wait: false` -- a waited move can block for up to ten minutes,
 * and the chamber state stream reports the result as it happens anyway.
 */
const MotionControls = () => {
  const call = useChamberPldCall();
  const chamber = useChamberPldStore((s) => s.chamber);
  const motion = chamber?.motion;
  const valves = sortedEntries(chamber?.valves);

  return (
    <Section title="Motion">
      <VStack align="stretch" spacing={2}>
        <Field label="Target">
          <SelectOp
            call={call}
            label="Target"
            options={TARGET_OPTIONS}
            action="Go"
            op={(c, target) => c.select_target({ target, wait: false })}
          />
        </Field>
        <Field label="Home axis">
          <SelectOp
            call={call}
            label="Axis to home"
            options={AXIS_OPTIONS}
            action="Home"
            op={(c, axis) => c.home_axis({ axis: axis as "TG" | "Mask1" | "RHEED gun X", wait: false })}
          />
        </Field>
        <Field label="Mask position (mm)">
          <NumberOp
            call={call}
            label="Mask position"
            unit="mm"
            action="Move"
            step={0.01}
            op={(c, position) => c.set_mask_position({ position, wait: false })}
          />
        </Field>
        <Field label="Sample angle (°)">
          <NumberOp
            call={call}
            label="Sample angle"
            unit="°"
            action="Move"
            step={0.1}
            op={(c, position) => c.set_sample_position({ position, wait: false })}
          />
        </Field>
        <Field label="RHEED gun X (mm)">
          <NumberOp
            call={call}
            label="RHEED gun X"
            unit="mm"
            action="Move"
            step={0.01}
            op={(c, position) => c.set_rheed_gun_x({ position, wait: false })}
          />
        </Field>
        <Field label="Target spin">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(motion?.target_spinning)}
            op={(c, on) => c.set_target_spin({ on })}
          />
        </Field>
        <Field label="Target twist">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(motion?.target_twisting)}
            op={(c, on) => c.set_target_twist({ on })}
          />
        </Field>
        <Field label="Motor free (release holding lock)">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(motion?.motor_free)}
            op={(c, on) => c.set_motor_free({ on })}
          />
        </Field>
        <Field label="Auto motion during fire">
          <HStack spacing={1} flexWrap="wrap" justify="flex-end">
            <OpButton call={call} op={(c) => c.set_target_auto_motion({ spin: true })}>
              Spin on
            </OpButton>
            <OpButton call={call} op={(c) => c.set_target_auto_motion({ spin: false })}>
              Spin off
            </OpButton>
            <OpButton call={call} op={(c) => c.set_target_auto_motion({ twist: true })}>
              Twist on
            </OpButton>
            <OpButton call={call} op={(c) => c.set_target_auto_motion({ twist: false })}>
              Twist off
            </OpButton>
          </HStack>
        </Field>

        {valves.length > 0 && (
          <VStack align="stretch" spacing="2px" pt={1} borderTopWidth="1px" borderColor="panel.border">
            <Text fontSize="xs" fontWeight="600" color="text.secondary">
              Valves
            </Text>
            {valves.map(([name, open]) => (
              <SwitchOp
                key={name}
                call={call}
                label={name}
                checked={open}
                op={(c, on) => c.set_valve({ valve: name, open: on, wait: false })}
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

export default MotionControls;
