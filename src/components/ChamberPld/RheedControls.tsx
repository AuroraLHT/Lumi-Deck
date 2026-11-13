import { Badge, HStack, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field, Section, fmt } from "./primitives";
import { NumberOp, OpButton, SwitchOp, TwoNumberOp } from "./controlPrimitives";


/** Under ~0.1 µA is the controller's idle noise, not a beam. */
const emission = (ua: number | null | undefined) =>
  ua == null ? "—" : ua < 0.1 ? "no emission" : `${ua.toFixed(1)} µA emission`;
/** Placeholder text naming the allowed range, read from the service's limits. */
const span = (lo: number | null | undefined, hi: number | null | undefined, unit: string) =>
  lo == null && hi == null ? unit : `${fmt(lo, 0)}–${fmt(hi, 0)} ${unit}`;

/** Where a ramp is while the set point being sent has not reached its target. */
const Ramp = ({
  label,
  set,
  target,
  digits,
  unit,
  down,
}: {
  label: string;
  /** The service's ramping-down flag: the ramp is the way to off, so say that. */
  down?: boolean;
  set: number | null | undefined;
  target: number | null | undefined;
  digits: number;
  unit: string;
}) =>
  down || (set != null && target != null && Math.abs(target - set) > 10 ** -digits / 2) ? (
    <Text fontSize="xs" color="status.warn">
      {label} ramping {down ? "down to off" : (target ?? 0) < (set ?? 0) ? "down" : "up"} {fmt(set, digits)} →{" "}
      {fmt(target, digits, ` ${unit}`)}
    </Text>
  ) : null;

/**
 * The RHEED gun through pld-service's handset link: filament, HV, focus and
 * X/Y deflection, and the emergency off.
 *
 * On with no value comes back to the set point from before the last off (or
 * the remembered one; refused if there is none). HV needs the filament on.
 * Filament (30 mA/s) and HV (500 V/s) ramp: on and set ops return when the
 * ramp starts, and its progress shows here from the state stream. Off is the
 * normal way down and ramps too -- filament off takes HV down first -- and
 * returns only once the gun is off, up to a couple of minutes from full; the
 * "ramping down" lines are pld-service's own flags, so a ramp-down started
 * from any client (the REA GUI too) shows here.
 * Focus (50 mA/s) and deflection (20 mA/s, X and Y together) ramp as well,
 * from 0 when that output is off, and return on arrival. So each of these has
 * its own call: one in flight shows as in progress and leaves the rest usable.
 *
 * Emergency off is unramped: everything off at once, for a fault. It needs no
 * control, like the laser STOP, and keeps the set points. An interlock, an
 * open filament or an over-current switches filament and HV off, and nothing
 * comes back on by itself.
 */
const RheedControls = () => {
  const call = useChamberPldCall();
  const filamentCall = useChamberPldCall();
  const hvCall = useChamberPldCall();
  const focusCall = useChamberPldCall();
  const deflectionCall = useChamberPldCall();
  const stopCall = useChamberPldCall();
  const rheed = useChamberPldStore((s) => s.chamber)?.rheed;

  if (!rheed?.present) {
    return (
      <Section title="RHEED gun">
        <Text fontSize="xs" color="text.muted">
          {rheed ? "pld-service has no RHEED link" : "No RHEED status from pld-service"}
        </Text>
      </Section>
    );
  }

  return (
    <Section title="RHEED gun">
      <VStack align="stretch" spacing={2}>
        <HStack spacing={1} flexWrap="wrap">
          {rheed.read_only ? (
            <Badge variant="subtle" colorScheme="gray" fontSize="0.65rem">
              read-only: every op is refused
            </Badge>
          ) : (
            <Badge variant="subtle" colorScheme={rheed.link_ok ? "green" : "red"} fontSize="0.65rem">
              {rheed.link_ok ? "link ok" : "no link"}
            </Badge>
          )}
          {rheed.interlock && (
            <Badge variant="solid" colorScheme="red" fontSize="0.65rem">
              interlock
            </Badge>
          )}
          {rheed.filament_open && (
            <Badge
              variant="solid"
              colorScheme="red"
              fontSize="0.65rem"
              title="Handset E002: burnt or broken filament suspected. Filament off or all off clears it."
            >
              filament open?
            </Badge>
          )}
          <Text fontSize="xs" color="text.muted" ml="auto">
            {emission(rheed.emission_ua)}
          </Text>
        </HStack>
        <HStack justify="space-between" align="flex-start">
          <Text fontSize="xs" color="text.muted">
            Normal way down: switch the filament off (it ramps HV first).
          </Text>
          <OpButton
            call={stopCall}
            colorScheme="red"
            title="Emergency stop: filament, HV, focus, X and Y off at once, unramped. Needs no control; set points are kept."
            op={(c) => c.rheed_all_off()}
          >
            Emergency off
          </OpButton>
        </HStack>

        <Field label={`Filament · ${fmt(rheed.filament_readback_ma, 0, " mA")}`}>
          <SwitchOp
            call={filamentCall}
            label=""
            ariaLabel="RHEED filament"
            checked={Boolean(rheed.filament_on)}
            op={(c, on) =>
              on ? c.rheed_filament_on({ ma: null }) : c.rheed_filament_off()
            }
          />
        </Field>
        <Field label={`Filament set point (${span(rheed.filament_min_ma, rheed.filament_max_ma, "mA")})`}>
          <NumberOp
            call={call}
            label="Filament set point"
            unit="mA"
            action="Ramp"
            step={10}
            op={(c, ma) => c.set_rheed_filament({ ma })}
          />
        </Field>
        <Ramp
          label={rheed.filament_ramping_down ? "Filament (HV first)" : "Filament"}
          down={rheed.filament_ramping_down}
          set={rheed.filament_set_ma} target={rheed.filament_target_ma} digits={0} unit="mA" />

        <Field label={`HV · ${fmt(rheed.hv_readback_kv, 2, " kV")}`}>
          <SwitchOp
            call={hvCall}
            label=""
            ariaLabel="RHEED HV"
            checked={Boolean(rheed.hv_on)}
            op={(c, on) => (on ? c.rheed_hv_on({ kv: null }) : c.rheed_hv_off())}
          />
        </Field>
        <Field label={`HV set point (${rheed.hv_max_kv != null ? `≤ ${fmt(rheed.hv_max_kv, 0)} kV` : "kV"})`}>
          <NumberOp
            call={call}
            label="HV set point"
            unit="kV"
            action="Ramp"
            step={0.5}
            op={(c, kv) => c.set_rheed_hv({ kv })}
          />
        </Field>
        <Ramp
          label="HV"
          down={rheed.hv_ramping_down && !rheed.filament_ramping_down}
          set={rheed.hv_set_kv} target={rheed.hv_target_kv} digits={2} unit="kV" />

        <Field label={`Focus · ${fmt(rheed.focus_readback_ma, 1, " mA")} (${span(rheed.focus_min_ma, rheed.focus_max_ma, "mA")})`}>
          <NumberOp
            call={focusCall}
            label="Focus"
            unit="mA"
            action="Set"
            step={1}
            op={(c, ma) => c.set_rheed_focus({ ma })}
          />
        </Field>
        {focusCall.busy && (
          <Text fontSize="xs" color="status.warn">
            Focus ramping at 50 mA/s…
          </Text>
        )}
        <Field
          label={`Deflection X / Y · ${fmt(rheed.x_readback_ma, 1)} / ${fmt(rheed.y_readback_ma, 1, " mA")} (X ${span(
            rheed.x_min_ma,
            rheed.x_max_ma,
            ""
          ).trim()}, Y ${span(rheed.y_min_ma, rheed.y_max_ma, "mA")})`}
        >
          <TwoNumberOp
            call={deflectionCall}
            labelA="Deflection X"
            labelB="Deflection Y"
            unitA="X mA"
            unitB="Y mA"
            action="Set"
            op={(c, x_ma, y_ma) => c.set_rheed_deflection({ x_ma, y_ma })}
          />
        </Field>
        {deflectionCall.busy && (
          <Text fontSize="xs" color="status.warn">
            Deflection ramping at 20 mA/s, X and Y together…
          </Text>
        )}

        {rheed.last_alert && (
          <Text fontSize="xs" color="status.warn" noOfLines={2} title={rheed.last_alert}>
            Last alert: {rheed.last_alert}
          </Text>
        )}
        {[call, filamentCall, hvCall, focusCall, deflectionCall, stopCall].map(
          (c, i) =>
            c.error && (
              <Text key={i} fontSize="xs" color="status.error">
                {c.error}
              </Text>
            )
        )}
      </VStack>
    </Section>
  );
};

export default RheedControls;
