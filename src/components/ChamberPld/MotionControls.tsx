import { Badge, HStack, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field, Section } from "./primitives";
import { ConfirmOpButton, NumberOp, OpButton, ReplyText, SelectOp, SwitchOp, useReply } from "./controlPrimitives";

const TARGET_OPTIONS = ["A", "B", "C", "D", "E", "F", "Clear"].map((t) => ({ value: t, label: t }));
const AXIS_OPTIONS = [
  { value: "TG", label: "Target carousel" },
  { value: "Mask1", label: "Mask" },
  { value: "RHEED gun X", label: "RHEED gun X" },
];

/**
 * Carousel, mask, sample and RHEED gun motion. (Valves are with the chamber
 * they serve, in VacuumControls.) Moves are
 * sent with `wait: false` -- a waited move can block for up to ten minutes,
 * and the chamber state stream reports the result as it happens anyway.
 *
 * STOP motors is PLD Controller's master Motor Stop: every axis halts, spin and
 * twist go off, a pulse train is stopped and a running sequence is cancelled.
 * Like STOP firing it needs no control, so it is a confirm button. Until Reset
 * motors (which needs control), pld-service refuses moves, homing, spin, twist
 * and fires; the axes that were moving lose their home reference. Their
 * replies are long, so they go full width under the row rather than under
 * the buttons.
 */
const MotionControls = () => {
  const call = useChamberPldCall();
  const motion = useChamberPldStore((s) => s.chamber?.motion);
  const [stopReply, setStopReply] = useReply();

  return (
    <Section title="Motion">
      <VStack align="stretch" spacing={2}>
        <Field label="STOP motors">
          <HStack spacing={1} justify="flex-end" align="flex-start">
            {motion?.motors_stopped && (
              <Badge colorScheme="red" variant="subtle" fontSize="0.65rem" mt="3px">
                latched
              </Badge>
            )}
            <ConfirmOpButton
              call={call}
              colorScheme="red"
              confirmLabel="Stop every motor now? A pulse train and a running sequence stop too; moves are refused until Reset motors, and an axis stopped mid-move must be homed."
              op={(c) => c.stop_motors()}
              onReply={setStopReply}
            >
              STOP
            </ConfirmOpButton>
            <OpButton
              call={call}
              isDisabled={!motion?.motors_stopped}
              title="Clear the motor stop (needs control). Spin and twist stay off."
              op={(c) => c.reset_motors()}
              onReply={setStopReply}
            >
              Reset motors
            </OpButton>
          </HStack>
        </Field>
        <ReplyText reply={stopReply} />
        {(motion?.homing_needed ?? []).length > 0 && (
          <Text fontSize="xs" color="status.warn">
            Home before relying on the position: {motion!.homing_needed!.join(", ")} (stopped mid-move)
          </Text>
        )}
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
