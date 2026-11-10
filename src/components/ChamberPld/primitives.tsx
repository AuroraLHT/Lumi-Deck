import { ReactNode } from "react";
import { Badge, Box, Flex, Text } from "@chakra-ui/react";

/** A titled block inside the PLD chamber panel. */
export const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2}>
    <Text fontSize="xs" fontWeight="600" color="text.secondary" mb={2}>
      {title}
    </Text>
    {children}
  </Box>
);

/**
 * A label/value row, the basic unit of every section here.
 *
 * Both sides get `minW={0}` so plain flex-shrink (not a hard floor on either
 * side) decides who gives way: it shrinks each side roughly in proportion to
 * its own content width, so a long label (e.g. "Current set -> monitor")
 * wraps onto a second line before a short numeric value does, while a short
 * label next to a long value (e.g. "Logging" with a full log-file path)
 * leaves the label alone and lets the value's own `noOfLines` ellipsis it.
 * Forcing one side to never shrink (as this used to) just moves the squeeze
 * onto the other side instead of fixing it.
 */
export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Flex justify="space-between" align="center" py="1px" fontSize="xs" gap={2}>
    <Text color="text.muted" minW={0}>
      {label}
    </Text>
    <Box textAlign="right" minW={0}>
      {children}
    </Box>
  </Flex>
);

/** A small on/off badge for the many boolean fields on PldChamberState. */
export const BoolBadge = ({
  value,
  onLabel = "on",
  offLabel = "off",
}: {
  value: boolean | null | undefined;
  onLabel?: string;
  offLabel?: string;
}) => (
  <Badge
    variant="subtle"
    colorScheme={value ? "green" : "gray"}
    fontSize="0.65rem"
  >
    {value ? onLabel : offLabel}
  </Badge>
);

/** `—` for null/undefined, so an absent reading never renders as the string "null". */
export const fmt = (
  v: number | null | undefined,
  digits = 1,
  unit = ""
): string => (v == null ? "—" : `${v.toFixed(digits)}${unit}`);

/**
 * Pressures here span 1e-7 to atmospheric; a fixed decimal count would print
 * either noise or all-zero for most of that range, so switch to exponential
 * below 0.001 and fixed above it.
 */
export const fmtTorr = (v: number | null | undefined): string => {
  if (v == null) return "—";
  if (v !== 0 && Math.abs(v) < 1e-3) return `${v.toExponential(2)} Torr`;
  return `${v.toFixed(3)} Torr`;
};

/**
 * TMP20/TMP21 are PLD Controller's "TMP2 (RHEED)"/"TMP4 (2nd RHEED)" button
 * names, not a location -- REA confirmed which physical pump each one is.
 */
const PUMP_LABELS: Record<string, string> = {
  TMP20: "TMP20 (RHEED, far from gun)",
  TMP21: "TMP21 (RHEED, near gun)",
};

export const pumpLabel = (name: string): string => PUMP_LABELS[name] ?? name;

const AXIS_COLOR: Record<string, string> = {
  IDLE: "gray",
  MOVING: "blue",
  HOMING: "orange",
  SETTLING: "purple",
};

export const AxisBadge = ({ status }: { status: string }) => (
  <Badge
    variant="subtle"
    colorScheme={AXIS_COLOR[status] ?? "gray"}
    fontSize="0.65rem"
  >
    {status.toLowerCase()}
  </Badge>
);
