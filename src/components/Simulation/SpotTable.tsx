import { Box, Table, Tbody, Td, Text, Th, Thead, Tr } from "@chakra-ui/react";

import { RheedSpot } from "../../generated/lumi";
import { SPOT_KINDS } from "../../stores/rheedSim";
import { KIND_LABEL, useKindColors } from "./spotKinds";
import { formatIndex } from "./indices";

const num = (n: number, digits = 1) => n.toFixed(digits);

/**
 * Every spot, as numbers: the table view of the pattern. Sorted by kind, then
 * Laue zone, then across the screen -- the order an operator reads a pattern.
 * Spots off the screen are listed too, dimmed, since "where did the 2 0 go"
 * is a question worth answering.
 */
const SpotTable = ({
  spots,
  hovered,
  onHover,
}: {
  spots: RheedSpot[];
  hovered: RheedSpot | null;
  onHover: (spot: RheedSpot | null) => void;
}) => {
  const colors = useKindColors();
  const sorted = [...spots].sort(
    (a, b) =>
      SPOT_KINDS.indexOf(a.kind) - SPOT_KINDS.indexOf(b.kind) ||
      (a.laue_zone ?? 99) - (b.laue_zone ?? 99) ||
      a.x_px - b.x_px
  );

  if (!sorted.length) return <Text fontSize="sm" color="text.muted">No spots.</Text>;

  return (
    <Box overflowX="auto">
      <Table size="sm" variant="simple" fontSize="xs">
        <Thead>
          <Tr>
            <Th>Label</Th>
            <Th>Kind</Th>
            <Th>hkl</Th>
            <Th isNumeric>Laue zone</Th>
            <Th isNumeric>x px</Th>
            <Th isNumeric>y px</Th>
            <Th isNumeric>Intensity</Th>
            <Th isNumeric>|q| 1/Å</Th>
          </Tr>
        </Thead>
        <Tbody>
          {sorted.map((s, i) => (
            <Tr
              key={i}
              opacity={s.in_view === false ? 0.45 : 1}
              bg={hovered === s ? "accent.subtle" : undefined}
              onMouseEnter={() => onHover(s)}
              onMouseLeave={() => onHover(null)}
              title={s.in_view === false ? "Off the screen" : undefined}
            >
              <Td fontFamily="mono" whiteSpace="nowrap">
                {s.label}
              </Td>
              <Td whiteSpace="nowrap">
                <Box
                  as="span"
                  display="inline-block"
                  boxSize="8px"
                  borderRadius="full"
                  border="2px solid"
                  borderColor={colors[s.kind]}
                  mr={1.5}
                />
                {KIND_LABEL[s.kind]}
              </Td>
              <Td fontFamily="mono" whiteSpace="nowrap">
                {formatIndex(s.hkl, "()")}
              </Td>
              <Td isNumeric>{s.laue_zone ?? "–"}</Td>
              <Td isNumeric>{num(s.x_px)}</Td>
              <Td isNumeric>{num(s.y_px)}</Td>
              <Td isNumeric>{num(s.intensity, 3)}</Td>
              <Td isNumeric>{num(Math.hypot(...s.q), 3)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};

export default SpotTable;
