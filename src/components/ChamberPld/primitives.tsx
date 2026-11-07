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

/** A label/value row, the basic unit of every section here. */
export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Flex justify="space-between" align="center" py="1px" fontSize="xs" gap={2}>
    <Text color="text.muted" flexShrink={0}>
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
