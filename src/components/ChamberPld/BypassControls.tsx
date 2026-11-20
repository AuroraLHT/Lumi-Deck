import { Badge, HStack, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field, Section } from "./primitives";
import { NumberOp, OpButton, ReplyText, useReply } from "./controlPrimitives";

/**
 * The bypass-valve stepper (an Arduino motor shield on its own pld-service
 * link). Shown only when pld-service has a bypass board configured.
 *
 * Moves are sent with `wait: false`, like the motion axes: a waited move holds
 * the call (and this section's busy state) until the valve gets there, and the
 * state stream shows the move anyway.
 *
 * Stop needs no control and has its own call, so a slow op here can never
 * leave it disabled. It is a plain button rather than a confirm: unlike STOP
 * motors it latches nothing, so there is nothing to undo. STOP motors also
 * stops the bypass and refuses bypass moves until Reset motors.
 *
 * Move to needs the valve homed (0 = the close switch); Home, Open fully and
 * Move by work unhomed. All four are off while pld-service has bypass motor
 * movement disabled (`[bypass] motion = 0`, the default while the mechanism is
 * redesigned): they are greyed out then, as in pld-gui. Stop, Speed and
 * Release still work. Move by empties its field once sent, so a double click
 * can't move twice as far.
 *
 * Every reply goes to one full-width line at the bottom rather than under its
 * control: refusals here are long, and a reply squeezed in beside a field
 * re-flows the rows -- a click aimed at Move to can land on Move by.
 */
const BypassControls = () => {
  const call = useChamberPldCall();
  const stopCall = useChamberPldCall();
  const bypass = useChamberPldStore((s) => s.chamber?.bypass);
  const motorsStopped = useChamberPldStore((s) => Boolean(s.chamber?.motion?.motors_stopped));
  const [reply, setReply] = useReply();

  if (!bypass?.present) return null;

  const maxSteps = bypass.max_steps ?? null;
  const maxRpm = bypass.max_rpm ?? null;
  const motionOff = bypass.motion_enabled === false;
  const motionOffTitle = motionOff ? "Bypass motor movement is disabled in pld-service ([bypass] motion = 0)." : undefined;

  return (
    <Section title="Bypass valve">
      <VStack align="stretch" spacing={2}>
        <Field label="Stop">
          <OpButton
            call={stopCall}
            colorScheme="red"
            title="Stop the bypass valve now (no control needed)."
            op={(c) => c.bypass_stop()}
            onReply={setReply}
          >
            STOP
          </OpButton>
        </Field>
        <Field label="Home / open fully">
          <HStack spacing={1} justify="flex-end">
            <OpButton
              call={call}
              isDisabled={motionOff}
              title={motionOffTitle ?? "Run to the close switch; position 0 there."}
              op={(c) => c.bypass_home({ wait: false })}
              onReply={setReply}
            >
              Home (close)
            </OpButton>
            <OpButton
              call={call}
              isDisabled={motionOff}
              title={motionOffTitle ?? "Run to the open switch; this also measures the open position."}
              op={(c) => c.bypass_open_fully({ wait: false })}
              onReply={setReply}
            >
              Open fully
            </OpButton>
          </HStack>
        </Field>
        {motionOff && (
          <Text fontSize="xs" color="status.warn">
            Motor movement disabled ([bypass] motion = 0): Home, Open fully and moves are refused.
          </Text>
        )}
        {motorsStopped && (
          <Text fontSize="xs" color="status.warn">
            Motor stop is latched: bypass moves are refused until Reset motors.
          </Text>
        )}
        {!motionOff && !bypass.homed && (
          <Text fontSize="xs" color="status.warn">
            Not homed: Move to is refused until Home.
          </Text>
        )}
        <Field label={`Move to (steps${maxSteps != null ? `, 0–${maxSteps}` : ""})`}>
          <NumberOp
            call={call}
            label="Bypass position in steps"
            unit="steps"
            action="Move"
            step={1}
            integer
            isDisabled={motionOff}
            title={motionOffTitle}
            min={0}
            max={maxSteps}
            op={(c, steps) => c.bypass_move_to({ steps, wait: false })}
            onReply={setReply}
          />
        </Field>
        <Field label="Move by (steps, + opens)">
          <NumberOp
            call={call}
            label="Bypass steps to move by"
            unit="± steps"
            action="Move"
            step={1}
            integer
            isDisabled={motionOff}
            title={motionOffTitle}
            min={maxSteps != null ? -maxSteps : null}
            max={maxSteps}
            op={(c, steps) => c.bypass_move_by({ steps, wait: false })}
            clearAfterSend
            onReply={setReply}
          />
        </Field>
        <Field label={`Speed (rpm${maxRpm != null ? `, ≤ ${maxRpm}` : ""})`}>
          <NumberOp
            call={call}
            label="Bypass speed in rpm"
            unit="rpm"
            action="Set"
            step={1}
            min={0.1}
            max={maxRpm}
            op={(c, rpm) => c.bypass_set_speed({ rpm })}
            onReply={setReply}
          />
        </Field>
        <Field label="Coils">
          <HStack spacing={1} justify="flex-end">
            {bypass.energized && (
              <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
                energized
              </Badge>
            )}
            <OpButton
              call={call}
              title="Stop and power the coils off. The board also does this 1 s after every move."
              op={(c) => c.bypass_release()}
              onReply={setReply}
            >
              Release
            </OpButton>
          </HStack>
        </Field>

        <ReplyText reply={reply} />

        {(call.error || stopCall.error) && (
          <Text fontSize="xs" color="status.error">
            {stopCall.error ?? call.error}
          </Text>
        )}
      </VStack>
    </Section>
  );
};

export default BypassControls;
