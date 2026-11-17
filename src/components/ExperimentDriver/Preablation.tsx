import { useState } from "react";
import { Badge, Box, Button, Flex, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ExperimentDriverClient, TargetPreablation } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import Section from "./Section";

const TABULAR = { fontVariantNumeric: "tabular-nums" };
/** Carousel viewports, not targets: nothing is ablated there. */
const VIEWPORTS = new Set(["Clear", "Monitor"]);

const useDriverQuery = <T,>(name: string, fn: (c: ExperimentDriverClient) => Promise<T>) => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const up = useExperimentDriverNodeStore((s) => s.state.is_available);
  return useQuery({
    queryKey: ["driver", host, name],
    queryFn: () => fn(new ExperimentDriverClient(transport!)),
    enabled: Boolean(transport) && up,
    staleTime: 60_000,
  });
};

/** One material: its stored amount, or an editor for it. */
const Row = ({
  material,
  row,
  loaded,
  onSaved,
}: {
  material: string;
  row?: TargetPreablation;
  loaded: boolean;
  onSaved: () => void;
}) => {
  const call = useDriverCall();
  const [editing, setEditing] = useState(false);
  const [pulses, setPulses] = useState(row ? String(row.num_pulse) : "");
  const [hz, setHz] = useState(row ? String(row.frequency) : "");
  const p = Number(pulses);
  const f = Number(hz);
  const valid =
    pulses.trim() !== "" &&
    Number.isInteger(p) &&
    p >= 0 &&
    (hz.trim() === "" || (Number.isFinite(f) && f > 0));

  const save = () =>
    call
      .run((c) =>
        c.set_target_preablation({
          target_material: material,
          num_pulse: p,
          ...(hz.trim() === "" ? {} : { frequency: f }),
        })
      )
      .then((r) => {
        if (!r) return;
        setEditing(false);
        onSaved();
      });

  return (
    <Box py="3px" borderBottomWidth="1px" borderColor="panel.border" _last={{ borderBottomWidth: 0 }}>
      <Flex align="center" gap={2} fontSize="xs" minH="24px" sx={TABULAR}>
        <Text fontWeight="600" w="96px" flexShrink={0} noOfLines={1} title={material}>
          {material}
        </Text>
        {editing ? (
          <HStack spacing={1} flex={1}>
            <Input
              size="xs"
              type="number"
              w="80px"
              aria-label={`${material} pre-ablation pulses`}
              placeholder="pulses"
              value={pulses}
              onChange={(e) => setPulses(e.target.value)}
            />
            <Input
              size="xs"
              type="number"
              w="64px"
              aria-label={`${material} pre-ablation rate`}
              placeholder="Hz"
              value={hz}
              onChange={(e) => setHz(e.target.value)}
            />
            <Button size="xs" colorScheme="blue" isLoading={call.busy} isDisabled={!valid} onClick={save}>
              Save
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </HStack>
        ) : (
          <>
            <Box flex={1}>
              {!row ? (
                <Text color="status.warn">not set: pre-ablation is refused</Text>
              ) : row.num_pulse === 0 ? (
                <Text color="text.muted">never pre-ablated</Text>
              ) : (
                <Text>
                  {row.num_pulse} pulses at {row.frequency} Hz
                </Text>
              )}
            </Box>
            {loaded && (
              <Badge variant="subtle" colorScheme="blue" fontSize="0.6rem" title="On the carousel now">
                loaded
              </Badge>
            )}
            <Text
              color="text.muted"
              fontSize="0.65rem"
              display={{ base: "none", md: "block" }}
              title={row?.set_at ? new Date(row.set_at * 1000).toLocaleString() : undefined}
            >
              {row?.set_by ?? ""}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              isDisabled={!call.canOperate}
              title={call.canOperate ? undefined : "Operator access required"}
              onClick={() => setEditing(true)}
            >
              {row ? "Edit" : "Set"}
            </Button>
          </>
        )}
      </Flex>
      {call.error && (
        <Text fontSize="0.65rem" color="status.error">
          {call.error}
        </Text>
      )}
    </Box>
  );
};

/**
 * How much each target material is pre-ablated before a deposition from it.
 * perform_preablation uses this amount unless one is given; a material with
 * none set is refused, and 0 means never pre-ablate it. Materials loaded on
 * the carousel are listed even before they have an amount.
 */
const PreablationSection = () => {
  const client = useQueryClient();
  const host = useTransportStore((s) => s.host);
  const amounts = useDriverQuery("target_preablation", (c) => c.list_target_preablation());
  const targets = useDriverQuery("targets", (c) => c.show_available_targets());
  const [other, setOther] = useState("");

  const byMaterial = new Map((amounts.data?.targets ?? []).map((r) => [r.target_material, r]));
  const loaded = new Set(
    Object.entries(targets.data?.targets ?? {})
      .filter(([slot, material]) => material && !VIEWPORTS.has(slot) && !VIEWPORTS.has(material))
      .map(([, material]) => material)
  );
  const materials = [...new Set([...loaded, ...byMaterial.keys()])].sort((a, b) => a.localeCompare(b));
  const [added, setAdded] = useState<string[]>([]);
  const shown = [...materials, ...added.filter((m) => !materials.includes(m))];
  const refresh = () => client.invalidateQueries({ queryKey: ["driver", host, "target_preablation"] });

  return (
    <Section title="Pre-ablation by material">
      <VStack align="stretch" spacing={1}>
        {amounts.isLoading ? (
          <Spinner size="xs" />
        ) : shown.length === 0 ? (
          <Text fontSize="xs" color="text.muted">
            No amounts set and no targets loaded.
          </Text>
        ) : (
          <VStack align="stretch" spacing={0}>
            {shown.map((m) => (
              <Row
                key={`${m}:${byMaterial.get(m)?.set_at ?? ""}`}
                material={m}
                row={byMaterial.get(m)}
                loaded={loaded.has(m)}
                onSaved={refresh}
              />
            ))}
          </VStack>
        )}
        <HStack spacing={1}>
          <Input
            size="xs"
            w="140px"
            aria-label="Another material"
            placeholder="another material"
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
          <Button
            size="xs"
            variant="ghost"
            isDisabled={!other.trim() || shown.includes(other.trim())}
            onClick={() => {
              setAdded((a) => [...a, other.trim()]);
              setOther("");
            }}
          >
            Add
          </Button>
        </HStack>
        {(amounts.error || targets.error) && (
          <Text fontSize="xs" color="status.error">
            {String(amounts.error ?? targets.error)}
          </Text>
        )}
      </VStack>
    </Section>
  );
};

export default PreablationSection;
