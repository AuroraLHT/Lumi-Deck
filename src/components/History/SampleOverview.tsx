import { Fragment, useMemo } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
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

import { ExperimentInfo, LayerInfo, StepInfo } from "../../generated/lumi";
import { useSampleSteps, useSubstrateExperiments } from "../../hooks/useHistory";
import { formatTime } from "./history";

const num = (value: unknown, digits?: number) =>
  typeof value === "number" ? (digits === undefined ? String(value) : value.toFixed(digits)) : "--";

/** The back pyrometer's emissivity before experiment 23; temperatures at it read differently. */
const OLD_EMISSIVITY = 0.65;

const Emissivity = ({ value }: { value: number | null | undefined }) =>
  value == null ? (
    <Text as="span" color="text.muted">
      --
    </Text>
  ) : (
    <Badge
      variant="subtle"
      colorScheme={Math.abs(value - OLD_EMISSIVITY) < 1e-6 ? "orange" : "gray"}
      title={
        Math.abs(value - OLD_EMISSIVITY) < 1e-6
          ? "The old pyrometer setting: its temperatures aren't comparable with 0.262"
          : undefined
      }
    >
      {value}
    </Badge>
  );

/**
 * The substrate's growth.db experiments. Temperature is only comparable
 * between experiments at the same pyrometer emissivity (0.65 before
 * experiment 23, 0.262 since), so it sits next to the temperature and a mix
 * is called out. A sequence run's layers are grouped under the sequence
 * version that grew them.
 */
const Experiments = ({ substrateId, pixelIndex }: { substrateId: number; pixelIndex: number | null }) => {
  const experiments = useSubstrateExperiments(substrateId);
  const rows: ExperimentInfo[] = experiments.data?.experiments ?? [];
  if (experiments.isLoading || rows.length === 0) return null;
  const mixed = new Set(rows.map((e) => e.pyrometer_emissivity).filter((v) => v != null)).size > 1;
  return (
    <Box>
      <SubHeading>Experiments on this substrate</SubHeading>
      {mixed && (
        <Alert status="warning" borderRadius="md" fontSize="sm" mb={2}>
          <AlertIcon />
          These experiments were measured at different pyrometer emissivities, so their temperatures
          aren't comparable across them.
        </Alert>
      )}
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th isNumeric>Exp</Th>
              <Th isNumeric>Pixel</Th>
              <Th>Material</Th>
              <Th isNumeric>Temp (°C)</Th>
              <Th isNumeric>Emissivity</Th>
              <Th isNumeric>Pressure</Th>
              <Th isNumeric>Pulses</Th>
              <Th isNumeric>Energy (mJ)</Th>
              <Th isNumeric>Meter ratio</Th>
              <Th>Created</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((e, i) => {
              const run = e.sequence_run_id ?? null;
              const startsRun = run != null && rows[i - 1]?.sequence_run_id !== run;
              const layers = run == null ? 0 : rows.filter((r) => r.sequence_run_id === run).length;
              return (
                <Fragment key={e.experiment_id}>
                  {startsRun && (
                    <Tr bg="panel.header">
                      <Td colSpan={10} fontSize="xs" py={1}>
                        <Text as="span" fontWeight="600">
                          Sequence {e.sequence_name ?? "?"} v{e.sequence_version ?? "?"}
                        </Text>
                        <Text as="span" color="text.muted" title={e.sequence_hash ?? undefined}>
                          {" "}
                          · run {run.slice(0, 8)} · {layers} layer{layers === 1 ? "" : "s"}
                          {e.sequence_hash ? ` · ${e.sequence_hash.slice(0, 12)}` : ""}
                        </Text>
                      </Td>
                    </Tr>
                  )}
                  <Tr
                    fontWeight={pixelIndex != null && e.is_pixel && e.pixel_location === pixelIndex ? "600" : undefined}
                    borderLeftWidth={run != null ? "3px" : undefined}
                    borderLeftColor={run != null ? "blue.300" : undefined}
                  >
                    <Td isNumeric>{e.experiment_id}</Td>
                    <Td isNumeric>{e.is_pixel ? num(e.pixel_location) : "--"}</Td>
                    <Td>{e.target_material ?? "--"}</Td>
                    <Td isNumeric>{num(e.temperature)}</Td>
                    <Td isNumeric>
                      <Emissivity value={e.pyrometer_emissivity} />
                    </Td>
                    <Td isNumeric>{num(e.pressure)}</Td>
                    <Td isNumeric>{num(e.num_pulse)}</Td>
                    <Td
                      isNumeric
                      title={e.laser_source_energy != null ? `source ${num(e.laser_source_energy, 1)} mJ` : undefined}
                    >
                      {num(e.laser_power)}
                    </Td>
                    <Td isNumeric>{num(e.laser_meter_ratio, 3)}</Td>
                    <Td>{formatTime(e.created_at)}</Td>
                  </Tr>
                </Fragment>
              );
            })}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

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
  substrateId,
  pixelIndex,
  layers,
  notes,
}: {
  sampleId: number;
  substrateId: number;
  pixelIndex: number | null;
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

      <Experiments substrateId={substrateId} pixelIndex={pixelIndex} />
    </VStack>
  );
};

export default SampleOverview;
