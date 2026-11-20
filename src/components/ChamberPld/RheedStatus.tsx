import { Badge, HStack, SimpleGrid, Text } from "@chakra-ui/react";

import { PldRheed } from "../../generated/lumi";
import { BoolBadge, Field, Section, fmt } from "./primitives";


/** Under ~0.1 µA is the controller's idle noise, not a beam. */
const emission = (ua: number | null | undefined) =>
  ua == null ? "—" : ua < 0.1 ? "no emission" : `${ua.toFixed(1)} µA`;
/** "lo–hi unit", or undefined when the service has not said. */
const range = (lo: number | null | undefined, hi: number | null | undefined, unit: string) =>
  lo == null && hi == null ? undefined : `Range ${fmt(lo, 0)}–${fmt(hi, 0)} ${unit}`;

/**
 * One output: its on/off, the set point being sent and, while a ramp runs
 * (set ≠ target), where it is heading, then the readback.
 */
const Output = ({
  label,
  on,
  set,
  target,
  read,
  digits,
  unit,
  limits,
}: {
  label: string;
  on: boolean | undefined;
  set: number | null | undefined;
  target?: number | null;
  read: number | null | undefined;
  digits: number;
  unit: string;
  limits?: string;
}) => {
  const ramping = target != null && set != null && Math.abs(target - set) > 10 ** -digits / 2;
  return (
    <Field label={label}>
      <HStack spacing={2} justify="flex-end" title={limits}>
        <Text fontSize="xs" whiteSpace="nowrap">
          {fmt(set, digits)}
          {ramping && (
            <Text as="span" color="status.warn">
              {" "}
              → {fmt(target, digits)}
            </Text>
          )}{" "}
          <Text as="span" color="text.muted">
            · read {fmt(read, digits, ` ${unit}`)}
          </Text>
        </Text>
        <BoolBadge value={on} />
      </HStack>
    </Field>
  );
};

/**
 * The RHEED gun's controller as pld-service reads it through the handset
 * port: filament, HV and emission, focus and X/Y deflection.
 *
 * pld-service ramps filament and HV (rates in the state, 30 mA/s and 500 V/s by default): `set`
 * is what it sends now and `target` the goal, so a ramp shows as set → target
 * until they meet. An interlock or a suspected open filament has already
 * switched filament and HV off; nothing comes back on by itself.
 */
const RheedStatus = ({ rheed }: { rheed: PldRheed | undefined }) => {
  if (!rheed?.present) {
    return (
      <Section title="RHEED gun">
        <Text fontSize="xs" color="text.muted">
          {rheed ? "pld-service has no RHEED link" : "No RHEED status from pld-service"}
        </Text>
      </Section>
    );
  }

  const link = rheed.read_only ? (
    <Badge variant="subtle" colorScheme="gray" fontSize="0.65rem" title="Hardware without --allow-operations: the port stays closed">
      read-only
    </Badge>
  ) : (
    <BoolBadge value={rheed.link_ok} onLabel="link ok" offLabel="no link" />
  );

  return (
    <Section title="RHEED gun">
      {(rheed.interlock || rheed.filament_open || rheed.filament_ramping_down || rheed.hv_ramping_down) && (
        <HStack spacing={1} mb={2} flexWrap="wrap">
          {rheed.interlock && (
            <Badge colorScheme="red" variant="subtle" fontSize="0.65rem">
              interlock: filament and HV off
            </Badge>
          )}
          {(rheed.filament_ramping_down || rheed.hv_ramping_down) && (
            <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
              {rheed.all_ramping_down ? "all off, ramping down" : rheed.filament_ramping_down ? "filament ramping down" : "HV ramping down"}
            </Badge>
          )}
          {rheed.filament_open && (
            <Badge colorScheme="red" variant="subtle" fontSize="0.65rem" title="Handset E002. Filament off or all off clears it.">
              filament open?
            </Badge>
          )}
        </HStack>
      )}
      <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
        <Field label="Controller">{link}</Field>
        <Output
          label="Filament"
          on={rheed.filament_on}
          set={rheed.filament_set_ma}
          target={rheed.filament_target_ma}
          read={rheed.filament_readback_ma}
          digits={0}
          unit="mA"
          limits={range(rheed.filament_min_ma, rheed.filament_max_ma, "mA")}
        />
        <Output
          label="HV"
          on={rheed.hv_on}
          set={rheed.hv_set_kv}
          target={rheed.hv_target_kv}
          read={rheed.hv_readback_kv}
          digits={2}
          unit="kV"
          limits={rheed.hv_max_kv == null ? undefined : `Up to ${fmt(rheed.hv_max_kv, 1)} kV`}
        />
        <Field label="Emission">
          <Text fontSize="xs">{emission(rheed.emission_ua)}</Text>
        </Field>
        <Output
          label="Focus"
          on={rheed.focus_on}
          set={rheed.focus_set_ma}
          read={rheed.focus_readback_ma}
          digits={1}
          unit="mA"
          limits={range(rheed.focus_min_ma, rheed.focus_max_ma, "mA")}
        />
        <Output
          label="Deflection X"
          on={rheed.x_on}
          set={rheed.x_set_ma}
          read={rheed.x_readback_ma}
          digits={1}
          unit="mA"
          limits={range(rheed.x_min_ma, rheed.x_max_ma, "mA")}
        />
        <Output
          label="Deflection Y"
          on={rheed.y_on}
          set={rheed.y_set_ma}
          read={rheed.y_readback_ma}
          digits={1}
          unit="mA"
          limits={range(rheed.y_min_ma, rheed.y_max_ma, "mA")}
        />
        <Field label="Remembered">
          <Text fontSize="xs" color="text.muted">
            {fmt(rheed.filament_last_ma, 0, " mA")} · {fmt(rheed.hv_last_kv, 2, " kV")}
          </Text>
        </Field>
      </SimpleGrid>
      {rheed.last_alert && (
        <Text fontSize="xs" color="status.warn" mt={1} noOfLines={2} title={rheed.last_alert}>
          Last alert: {rheed.last_alert}
        </Text>
      )}
    </Section>
  );
};

export default RheedStatus;
