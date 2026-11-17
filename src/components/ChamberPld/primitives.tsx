import { ReactNode, useState } from "react";
import {
  Badge,
  Box,
  Flex,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
} from "@chakra-ui/react";

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
 * The value side gets `minW={0}` so plain flex-shrink decides how much room
 * it gives up: a long label (e.g. "Current set -> monitor") still wraps onto
 * a second line before a short numeric value does, and a short label next to
 * a long value (e.g. "Logging" with a full log-file path) leaves the label
 * alone and lets the value's own `noOfLines` ellipsis it.
 *
 * The label side gets a floor (`minW="44px"`) instead of `minW={0}`: when the
 * column itself is narrow AND the value is a genuinely long, unbreakable
 * string (a path, no spaces to wrap at), proportional flex-shrink isn't
 * scale-invariant -- the value's huge basis against a tiny available width
 * drags even a short label's *share* of the overflow down to a few px,
 * wrapping it one character per line. A small floor stops that without
 * blocking the long-label-wraps-first behavior above (that still needs more
 * than 44px to wrap at a word boundary anyway).
 *
 * The outer `Flex` itself also needs `minW={0}`: as a grid item inside the
 * `SimpleGrid` sections use, it defaults to `min-width: auto` same as any
 * flex/grid item, so an unbreakable value would overflow past the grid cell
 * instead of shrinking down to where `noOfLines` can actually ellipsize it.
 */
export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Flex justify="space-between" align="center" py="1px" fontSize="xs" gap={2} minW={0}>
    <Text color="text.muted" minW="44px">
      {label}
    </Text>
    <Box textAlign="right" minW={0}>
      {children}
    </Box>
  </Flex>
);

/**
 * A long value from the server (a file path, a full error message, ...)
 * collapsed to one line with an ellipsis. Hovering shows the native `title`
 * tooltip, and clicking/tapping opens a popover with the full text in a
 * scrollable box -- the tap target tablets need, since they have no hover.
 */
export const TruncatedText = ({
  text,
  fontSize = "xs",
}: {
  text: string | null | undefined;
  fontSize?: string;
}) => {
  // A Popover (and its Portal) per row is costly in long lists re-rendered
  // every state push; until it is first opened this is plain text.
  const [armed, setArmed] = useState(false);
  if (!text) {
    return (
      <Text fontSize={fontSize} color="text.muted">
        —
      </Text>
    );
  }
  if (!armed) {
    return (
      <Text fontSize={fontSize} noOfLines={1} cursor="pointer" title={text} onClick={() => setArmed(true)}>
        {text}
      </Text>
    );
  }
  return (
    <Popover placement="top-end" isLazy defaultIsOpen>
      <PopoverTrigger>
        <Text fontSize={fontSize} noOfLines={1} cursor="pointer" title={text}>
          {text}
        </Text>
      </PopoverTrigger>
      <Portal>
        <PopoverContent bg="panel.bgElevated" borderColor="panel.border" w="auto" maxW="min(320px, 90vw)">
          <PopoverArrow bg="panel.bgElevated" />
          <PopoverBody
            maxH="200px"
            overflowY="auto"
            fontSize={fontSize}
            wordBreak="break-all"
            whiteSpace="pre-wrap"
          >
            {text}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

/**
 * `Object.entries` on a `Record<string, T>` pushed fresh over JSON every tick
 * follows whatever key order that tick's payload happened to serialize in,
 * which is not guaranteed stable -- sort explicitly so rows (e.g. valves)
 * don't visibly reorder from one state push to the next.
 */
export const sortedEntries = <T,>(obj: Record<string, T> | null | undefined): [string, T][] =>
  Object.entries(obj ?? {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

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

const PUMP_STATE_COLOR: Record<string, string> = {
  off: "gray",
  starting: "orange",
  "at speed": "green",
  stopping: "orange",
};

/**
 * `PldPump.state` is already the authoritative 4-value string (off/starting/
 * at speed/stopping) -- showing it as one badge replaces the previous
 * on/off `BoolBadge` + a muted-text copy of the same state, which both
 * doubled up the text (state and badge said "at speed" side by side) and
 * collapsed "starting"/"stopping" into a guess from the `running` bit.
 */
export const PumpStateBadge = ({ state }: { state: string | null | undefined }) => (
  <Badge
    variant="subtle"
    colorScheme={PUMP_STATE_COLOR[state ?? ""] ?? "gray"}
    fontSize="0.65rem"
  >
    {state ?? "—"}
  </Badge>
);
