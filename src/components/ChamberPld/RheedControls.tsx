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

/** The filament's floor when pld-service has not said: it goes on, and comes down to, 507 mA. */
const FILAMENT_FLOOR_MA = 507;

/** Seconds to cover `distance` at `rate` per second; null when either is unknown. */
const secondsAt = (distance: number | null | undefined, rate: number | null | undefined) =>
  distance == null || !rate ? null : Math.abs(distance) / rate;

const fmtEta = (s: number | null) =>
  s == null ? "" : s < 1 ? " · under 1 s left" : s < 90 ? ` · about ${Math.ceil(s)} s left` : ` · about ${Math.round(s / 60)} min left`;

/**
 * Where a ramp is while the set point being sent has not reached its target,
 * and how long it has left at the service's own ramp rate.
 */
const Ramp = ({
  label,
  set,
  target,
  digits,
  unit,
  down,
  eta,
}: {
  label: string;
  /** The service's ramping-down flag: the ramp is the way to off, so say that. */
  down?: boolean;
  set: number | null | undefined;
  target: number | null | undefined;
  digits: number;
  unit: string;
  /** Seconds left, from the state's ramp rates. */
  eta: number | null;
}) =>
  down || (set != null && target != null && Math.abs(target - set) > 10 ** -digits / 2) ? (
    <Text fontSize="xs" color="status.warn" sx={{ fontVariantNumeric: "tabular-nums" }}>
      {label} ramping {down ? "down" : (target ?? 0) < (set ?? 0) ? "down" : "up"} {fmt(set, digits)} →{" "}
      {down ? "off" : fmt(target, digits, ` ${unit}`)}
      {fmtEta(eta)}
    </Text>
  ) : null;

/**
 * The RHEED gun through pld-service's handset link: filament, HV, focus and
 * X/Y deflection, all off and the emergency off.
 *
 * On with no value switches on at the bottom -- the filament at its 507 mA
 * floor, HV at 0 kV -- and holds there until a set point is ramped to. HV
 * needs the filament on. Filament and HV ramp at the service's configured
 * rates (in the state, so the time left shows): on and set ops return when
 * the ramp starts, and its progress shows here from the state stream. Off
 * ramps too -- filament off takes HV down first -- and returns only once the
 * gun is off; the "ramping down" lines are pld-service's own flags, so a
 * ramp-down started from any client (the REA GUI too) shows here.
 * Focus (50 mA/s) and deflection (20 mA/s, X and Y together) ramp as well,
 * from 0 when that output is off, and return on arrival. So each of these has
 * its own call: one in flight shows as in progress and leaves the rest usable.
 *
 * All off is the normal way down: HV, then the filament, ramped off, then
 * focus, X and Y. Emergency off is unramped: everything off at once, for a
 * fault. Neither needs control, like the laser STOP, and both keep the set
 * points. An interlock, an open filament or an over-current switches filament
 * and HV off, and nothing comes back on by itself.
 */
const RheedControls = () => {
  const call = useChamberPldCall();
  const filamentCall = useChamberPldCall();
  const hvCall = useChamberPldCall();
  const focusCall = useChamberPldCall();
  const deflectionCall = useChamberPldCall();
  const allOffCall = useChamberPldCall();
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

  const filamentFloor = rheed.filament_min_ma ?? FILAMENT_FLOOR_MA;
  const hvDownS = secondsAt((rheed.hv_set_kv ?? 0) * 1000, rheed.hv_ramp_v_per_s);
  const filamentDownS = secondsAt((rheed.filament_set_ma ?? filamentFloor) - filamentFloor, rheed.filament_ramp_ma_per_s);
  // Filament off (and all off) takes HV down first, so its time includes HV's.
  const filamentEta = rheed.filament_ramping_down
    ? rheed.hv_on && hvDownS != null && filamentDownS != null
      ? hvDownS + filamentDownS
      : filamentDownS
    : secondsAt((rheed.filament_target_ma ?? 0) - (rheed.filament_set_ma ?? 0), rheed.filament_ramp_ma_per_s);
  const hvEta = rheed.hv_ramping_down
    ? hvDownS
    : secondsAt(((rheed.hv_target_kv ?? 0) - (rheed.hv_set_kv ?? 0)) * 1000, rheed.hv_ramp_v_per_s);

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
        <HStack justify="flex-end" align="flex-start" spacing={2}>
          <OpButton
            call={allOffCall}
            colorScheme="orange"
            variant="outline"
            title="The normal way down: HV and the filament ramped off, then focus, X and Y off. Needs no control; set points are kept."
            op={(c) => c.rheed_all_off_gentle()}
          >
            All off
          </OpButton>
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
          label={rheed.filament_ramping_down && rheed.hv_on ? "Filament (HV first)" : "Filament"}
          down={rheed.filament_ramping_down}
          set={rheed.filament_set_ma} target={rheed.filament_target_ma} digits={0} unit="mA" eta={filamentEta} />

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
          set={rheed.hv_set_kv} target={rheed.hv_target_kv} digits={2} unit="kV" eta={hvEta} />
        {rheed.all_ramping_down && (
          <Text fontSize="xs" color="status.warn">
            All off: focus, X and Y go off once filament and HV are down.
          </Text>
        )}

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

        {rheed.filament_open && (
          <Text fontSize="xs" color="status.error">
            Filament open? It stays off. Filament off or all off clears the flag once the filament is fixed.
          </Text>
        )}
        {rheed.interlock && (
          <Text fontSize="xs" color="status.error">
            Interlock: filament and HV are off and are refused until it is cleared.
          </Text>
        )}
        {rheed.last_alert && (
          <Text fontSize="xs" color="status.warn" noOfLines={2} title={rheed.last_alert}>
            Last alert: {rheed.last_alert}
          </Text>
        )}
        {[call, filamentCall, hvCall, focusCall, deflectionCall, allOffCall, stopCall].map(
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
