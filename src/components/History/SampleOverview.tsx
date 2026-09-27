import { useMemo } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Heading,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";

import { LayerInfo, StepInfo } from "../../generated/lumi";
import { useSampleSteps } from "../../hooks/useHistory";
import { formatTime } from "./history";

const num = (value: unknown, digits?: number) =>
  typeof value === "number" ? (digits === undefined ? String(value) : value.toFixed(digits)) : "--";

const SubHeading = ({ children }: { children: string }) => (
  <Heading size="xs" color="text.secondary" textTransform="uppercase" letterSpacing="0.04em" mb={2}>
    {children}
  </Heading>
);

/**
 * The sample as a record: what was grown on it. (What it measured is the
 * Measurements tab.)
 *
 * Layers are `get_sample`'s stack, derived by the backend from the depositions
 * that succeeded -- what was grown, not what was planned. Their conditions come
 * from the deposition step each layer names, which is where the journal keeps
 * the parameters it ran with.
 */
const SampleOverview = ({
  sampleId,
  layers,
  notes,
}: {
  sampleId: number;
  layers: LayerInfo[];
  notes?: string | null;
}) => {
  const steps = useSampleSteps(sampleId);

  const stepById = useMemo(
    () => new Map((steps.data?.steps ?? []).map((s): [number, StepInfo] => [s.step_id, s])),
    [steps.data]
  );

  return (
    <VStack align="stretch" spacing={6}>
      {notes && (
        <Alert status="warning" borderRadius="md" fontSize="sm">
          <AlertIcon />
          {notes}
        </Alert>
      )}

      <Box>
        <SubHeading>Layers, bottom up</SubHeading>
        {layers.length === 0 ? (
          <Text fontSize="sm" color="text.muted">
            Nothing grown on this sample yet.
          </Text>
        ) : (
          <TableContainer>
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th isNumeric>#</Th>
                  <Th>Material</Th>
                  <Th isNumeric>Pulses</Th>
                  <Th isNumeric>Temp (°C)</Th>
                  <Th isNumeric>Pressure</Th>
                  <Th isNumeric>Rate (Hz)</Th>
                  <Th>Target</Th>
                  <Th>Grown</Th>
                </Tr>
              </Thead>
              <Tbody>
                {layers.map((layer) => {
                  const params = (layer.step_id != null && stepById.get(layer.step_id)?.params) || {};
                  return (
                    <Tr key={layer.seq}>
                      <Td isNumeric>{layer.seq + 1}</Td>
                      <Td fontWeight="600">
                        {layer.material ?? "--"}
                        {layer.is_dryrun && (
                          <Text as="span" color="text.muted" fontWeight="400">
                            {" "}
                            (dry run)
                          </Text>
                        )}
                      </Td>
                      <Td isNumeric>{num(layer.num_pulse)}</Td>
                      <Td isNumeric>{num(params.temperature)}</Td>
                      <Td isNumeric>{num(params.pressure)}</Td>
                      <Td isNumeric>{num(params.laser_repetition_rate)}</Td>
                      <Td>{typeof params.target_id === "string" ? params.target_id : "--"}</Td>
                      <Td>{formatTime(layer.started_at)}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </VStack>
  );
};

export default SampleOverview;
