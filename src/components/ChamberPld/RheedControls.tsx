import { ReactNode } from "react";
import { Badge, Box, Flex, HStack, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Section, fmt } from "./primitives";
import { LastGunAction } from "./ActivityList";
import { AnyReply, NumberOp, OpButton, ReplyText, SwitchOp, TwoNumberOp, useReply } from "./controlPrimitives";

const TABULAR = { fontVariantNumeric: "tabular-nums" };

/** Under ~0.1 µA is the controller's idle noise, not a beam. */
const emission = (ua: number | null | undefined) =>
  ua == null ? "—" : ua < 0.1 ? "no emission" : `${ua.toFixed(1)} µA emission`;
/** The allowed range, read from the service's limits. */
const span = (lo: number | null | undefined, hi: number | null | undefined, unit: string) =>
  lo == null && hi == null ? "" : `${fmt(lo, 0)} to ${fmt(hi, 0)} ${unit}`.trim();

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
  set,
  target,
  digits,
  unit,
  down,
  eta,
  note,
}: {
  /** The service's ramping-down flag: the ramp is the way to off, so say that. */
  down?: boolean;
  set: number | null | undefined;
  target: number | null | undefined;
  digits: number;
  unit: string;
  /** Seconds left, from the state's ramp rates. */
  eta: number | null;
  /** Added after "ramping down", e.g. that HV goes first. */
  note?: string;
}) =>
  down || (set != null && target != null && Math.abs(target - set) > 10 ** -digits / 2) ? (
    <Text fontSize="xs" color="status.warn" sx={TABULAR}>
      Ramping {down ? "down" : (target ?? 0) < (set ?? 0) ? "down" : "up"}
      {note && ` (${note})`} {fmt(set, digits)} → {down ? "off" : fmt(target, digits, ` ${unit}`)}
      {fmtEta(eta)}
    </Text>
  ) : null;

/** What an output is doing now, then its last reply or error: one full-width line each, left aligned. */
const Status = ({ children, reply, error }: { children?: ReactNode; reply: AnyReply | null; error?: string | null }) =>
  children || reply?.message || error ? (
    <VStack align="stretch" spacing="1px" mt={1}>
      {children}
      <ReplyText reply={reply} align="left" />
      {error && (
        <Text fontSize="0.65rem" color="status.error">
          {error}
        </Text>
      )}
    </VStack>
  ) : null;

/**
 * One output of the gun: its name, reading and switch on one row, its set
 * point and allowed range on the next, then what it is doing.
 */
const Output = ({
  name,
  reading,
  toggle,
  range,
  setter,
  status,
}: {
  name: string;
  reading: string;
  toggle?: ReactNode;
  range: string;
  setter: ReactNode;
  status: ReactNode;
}) => (
  <Box borderTopWidth="1px" borderColor="panel.border" pt={2}>
    <Flex align="center" gap={2} minH="20px">
      <Text fontSize="xs" fontWeight="600">
        {name}
      </Text>
      <Text fontSize="xs" ml="auto" sx={TABULAR}>
        {reading}
      </Text>
      {toggle}
    </Flex>
    <Flex align="center" gap={2} mt={1} flexWrap="wrap">
      <Text fontSize="0.65rem" color="text.muted" flex="1 1 80px">
        {range && `Range ${range}`}
      </Text>
      <Box ml="auto">{setter}</Box>
    </Flex>
    {status}
  </Box>
);

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
 * All off is the normal way down: HV, then the filament, ramped off; focus,
 * X and Y stay on. Emergency off (pld-service's "ALL OFF BRUTAL") is
 * unramped: everything off at once, focus, X and Y too, for a fault. Neither needs control, like the laser STOP, and both keep the set
 * points. An interlock, an open filament or an over-current switches filament
 * and HV off, and nothing comes back on by itself.
 */
const RheedControls = () => {
  const filamentCall = useChamberPldCall();
  const filamentSetCall = useChamberPldCall();
  const hvCall = useChamberPldCall();
  const hvSetCall = useChamberPldCall();
  const focusCall = useChamberPldCall();
  const deflectionCall = useChamberPldCall();
  const allOffCall = useChamberPldCall();
  const stopCall = useChamberPldCall();
  const [gunReply, setGunReply] = useReply();
  const [filamentReply, setFilamentReply] = useReply();
  const [hvReply, setHvReply] = useReply();
  const [focusReply, setFocusReply] = useReply();
  const [deflectionReply, setDeflectionReply] = useReply();
  const rheed = useChamberPldStore((s) => s.chamber?.rheed);

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
  const hvFirst = rheed.filament_ramping_down && rheed.hv_on;
  const filamentEta = rheed.filament_ramping_down
    ? hvFirst && hvDownS != null && filamentDownS != null
      ? hvDownS + filamentDownS
      : filamentDownS
    : secondsAt((rheed.filament_target_ma ?? 0) - (rheed.filament_set_ma ?? 0), rheed.filament_ramp_ma_per_s);
  const hvEta = rheed.hv_ramping_down
    ? hvDownS
    : secondsAt(((rheed.hv_target_kv ?? 0) - (rheed.hv_set_kv ?? 0)) * 1000, rheed.hv_ramp_v_per_s);
  const gunError = allOffCall.error ?? stopCall.error;

  return (
    <Section title="RHEED gun">
      <VStack align="stretch" spacing={2}>
        <Flex align="center" gap={1} flexWrap="wrap">
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
        </Flex>
        <Box>
          <HStack justify="flex-end" spacing={2}>
            <OpButton
              call={allOffCall}
              colorScheme="orange"
              variant="outline"
              title="The normal way down: HV and the filament ramped off; focus, X and Y stay on. Needs no control; set points are kept."
              op={(c) => c.rheed_all_off_gentle()}
              onReply={setGunReply}
            >
              All off
            </OpButton>
            <OpButton
              call={stopCall}
              colorScheme="red"
              title="Emergency stop: filament, HV, focus, X and Y off at once, unramped. Needs no control; set points are kept."
              op={(c) => c.rheed_all_off()}
              onReply={setGunReply}
            >
              Emergency off
            </OpButton>
          </HStack>
          <Box mt={1}>
            <LastGunAction />
          </Box>
          <Status reply={gunReply} error={gunError}>
            {rheed.all_ramping_down && (
              <Text fontSize="xs" color="status.warn">
                All off in progress: HV, then the filament, ramping down.
              </Text>
            )}
          </Status>
        </Box>

        <Output
          name="Filament"
          reading={fmt(rheed.filament_readback_ma, 0, " mA")}
          toggle={
            <SwitchOp
              call={filamentCall}
              label=""
              ariaLabel="RHEED filament"
              checked={Boolean(rheed.filament_on)}
              op={(c, on) => (on ? c.rheed_filament_on({ ma: null }) : c.rheed_filament_off())}
              onReply={setFilamentReply}
            />
          }
          range={span(rheed.filament_min_ma, rheed.filament_max_ma, "mA")}
          setter={
            <NumberOp
              call={filamentSetCall}
              label="Filament set point"
              unit="mA"
              action="Ramp"
              step={10}
              op={(c, ma) => c.set_rheed_filament({ ma })}
              onReply={setFilamentReply}
            />
          }
          status={
            <Status reply={filamentReply} error={filamentCall.error ?? filamentSetCall.error}>
              <Ramp
                down={rheed.filament_ramping_down}
                note={hvFirst ? "HV first" : undefined}
                set={rheed.filament_set_ma}
                target={rheed.filament_target_ma}
                digits={0}
                unit="mA"
                eta={filamentEta}
              />
            </Status>
          }
        />

        <Output
          name="HV"
          reading={fmt(rheed.hv_readback_kv, 2, " kV")}
          toggle={
            <SwitchOp
              call={hvCall}
              label=""
              ariaLabel="RHEED HV"
              checked={Boolean(rheed.hv_on)}
              op={(c, on) => (on ? c.rheed_hv_on({ kv: null }) : c.rheed_hv_off())}
              onReply={setHvReply}
            />
          }
          range={rheed.hv_max_kv != null ? `0 to ${fmt(rheed.hv_max_kv, 0)} kV` : ""}
          setter={
            <NumberOp
              call={hvSetCall}
              label="HV set point"
              unit="kV"
              action="Ramp"
              step={0.5}
              op={(c, kv) => c.set_rheed_hv({ kv })}
              onReply={setHvReply}
            />
          }
          status={
            <Status reply={hvReply} error={hvCall.error ?? hvSetCall.error}>
              <Ramp
                down={rheed.hv_ramping_down && !rheed.filament_ramping_down}
                set={rheed.hv_set_kv}
                target={rheed.hv_target_kv}
                digits={2}
                unit="kV"
                eta={hvEta}
              />
            </Status>
          }
        />

        <Output
          name="Focus"
          reading={fmt(rheed.focus_readback_ma, 1, " mA")}
          range={span(rheed.focus_min_ma, rheed.focus_max_ma, "mA")}
          setter={
            <NumberOp
              call={focusCall}
              label="Focus"
              unit="mA"
              action="Set"
              step={1}
              min={rheed.focus_min_ma}
              max={rheed.focus_max_ma}
              op={(c, ma) => c.set_rheed_focus({ ma })}
              onReply={setFocusReply}
            />
          }
          status={
            <Status reply={focusReply} error={focusCall.error}>
              {focusCall.busy && (
                <Text fontSize="xs" color="status.warn">
                  Ramping at 50 mA/s…
                </Text>
              )}
            </Status>
          }
        />

        <Output
          name="Deflection X / Y"
          reading={`${fmt(rheed.x_readback_ma, 1)} / ${fmt(rheed.y_readback_ma, 1, " mA")}`}
          range={[
            span(rheed.x_min_ma, rheed.x_max_ma, "") && `X ${span(rheed.x_min_ma, rheed.x_max_ma, "")}`,
            span(rheed.y_min_ma, rheed.y_max_ma, "") && `Y ${span(rheed.y_min_ma, rheed.y_max_ma, "mA")}`,
          ]
            .filter(Boolean)
            .join(", ")}
          setter={
            <TwoNumberOp
              call={deflectionCall}
              labelA="Deflection X"
              labelB="Deflection Y"
              unitA="X mA"
              unitB="Y mA"
              minA={rheed.x_min_ma}
              maxA={rheed.x_max_ma}
              minB={rheed.y_min_ma}
              maxB={rheed.y_max_ma}
              action="Set"
              op={(c, x_ma, y_ma) => c.set_rheed_deflection({ x_ma, y_ma })}
              onReply={setDeflectionReply}
            />
          }
          status={
            <Status reply={deflectionReply} error={deflectionCall.error}>
              {deflectionCall.busy && (
                <Text fontSize="xs" color="status.warn">
                  Ramping at 20 mA/s, X and Y together…
                </Text>
              )}
            </Status>
          }
        />

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
      </VStack>
    </Section>
  );
};

export default RheedControls;
