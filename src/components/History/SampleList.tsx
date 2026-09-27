import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Select,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";

import { SampleInfo } from "../../generated/lumi";
import { useSamples, useSubstrates } from "../../hooks/useHistory";
import { STATE_SCHEME } from "./history";

export interface SampleFilter {
  substrateId: number | null;
  state: string | null;
  search: string;
}

const SEARCH_DEBOUNCE_MS = 300;

const sampleLabel = (s: SampleInfo) =>
  s.kind === "substrate"
    ? "Whole substrate"
    : s.pixel_index != null
    ? `Position ${s.pixel_index}`
    : s.sample_name ?? `Sample ${s.sample_id}`;

/**
 * Samples, grouped under their substrate. Filtering is the backend's
 * (`list_samples`), so the search matches whatever growth.db treats as a
 * sample's descriptive columns, not just what is on screen.
 */
const SampleList = ({
  filter,
  onFilter,
  selected,
  onSelect,
}: {
  filter: SampleFilter;
  onFilter: (next: SampleFilter) => void;
  selected: number | null;
  onSelect: (sampleId: number) => void;
}) => {
  const substrates = useSubstrates();
  const [search, setSearch] = useState(filter.search);

  // Typing is local; the query (and the URL) follow once it settles.
  useEffect(() => {
    if (search === filter.search) return;
    const timer = setTimeout(() => onFilter({ ...filter, search }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filter, onFilter]);

  const samples = useSamples({
    substrate_id: filter.substrateId,
    state: filter.state,
    search: filter.search || null,
  });

  const substrateNames = useMemo(
    () =>
      new Map(
        (substrates.data?.substrates ?? []).map((s) => [
          s.substrate_id,
          s.substrate_name || `Substrate ${s.substrate_id}`,
        ])
      ),
    [substrates.data]
  );

  // Newest substrate first; within one, the substrate itself, then by position.
  const groups = useMemo(() => {
    const bySubstrate = new Map<number, SampleInfo[]>();
    for (const s of samples.data?.samples ?? []) {
      const list = bySubstrate.get(s.substrate_id) ?? [];
      list.push(s);
      bySubstrate.set(s.substrate_id, list);
    }
    return [...bySubstrate.entries()]
      .sort(([a], [b]) => b - a)
      .map(([substrateId, list]) => ({
        substrateId,
        samples: list.sort(
          (a, b) =>
            Number(b.kind === "substrate") - Number(a.kind === "substrate") ||
            (a.pixel_index ?? 0) - (b.pixel_index ?? 0)
        ),
      }));
  }, [samples.data]);

  const page = samples.data?.page;

  return (
    <VStack align="stretch" spacing={2} h="100%" minH={0}>
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <Icon as={LuSearch} color="text.muted" />
        </InputLeftElement>
        <Input
          placeholder="Search samples"
          aria-label="Search samples"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          borderRadius="md"
        />
      </InputGroup>
      <HStack spacing={2}>
        <Select
          size="sm"
          aria-label="Substrate"
          value={filter.substrateId ?? ""}
          onChange={(e) =>
            onFilter({ ...filter, substrateId: e.target.value ? Number(e.target.value) : null })
          }
          borderRadius="md"
        >
          <option value="">All substrates</option>
          {(substrates.data?.substrates ?? []).map((s) => (
            <option key={s.substrate_id} value={s.substrate_id}>
              {substrateNames.get(s.substrate_id)}
              {s.materials ? ` (${s.materials})` : ""}
            </option>
          ))}
        </Select>
        <Select
          size="sm"
          aria-label="State"
          value={filter.state ?? ""}
          onChange={(e) => onFilter({ ...filter, state: e.target.value || null })}
          borderRadius="md"
          w="120px"
          flexShrink={0}
        >
          <option value="">Any state</option>
          <option value="grown">Grown</option>
          <option value="active">Active</option>
          <option value="planned">Planned</option>
        </Select>
      </HStack>

      <Box flex={1} minH={0} overflowY="auto" mx={-1} px={1}>
        {!samples.nodeUp ? (
          <Text fontSize="sm" color="text.muted" py={4}>
            The experiment node is not running, so growth.db cannot be read.
          </Text>
        ) : samples.isPending ? (
          <HStack py={4} color="text.muted">
            <Spinner size="sm" />
            <Text fontSize="sm">Loading samples…</Text>
          </HStack>
        ) : samples.isError ? (
          <Text fontSize="sm" color="status.error" py={4}>
            {samples.error.message}
          </Text>
        ) : groups.length === 0 ? (
          <Text fontSize="sm" color="text.muted" py={4}>
            No samples match.
          </Text>
        ) : (
          <VStack align="stretch" spacing={3}>
            {groups.map((group) => (
              <Box key={group.substrateId} role="group" aria-label={substrateNames.get(group.substrateId)}>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="text.secondary"
                  textTransform="uppercase"
                  letterSpacing="0.04em"
                  px={2}
                  mb={1}
                >
                  {substrateNames.get(group.substrateId) ?? `Substrate ${group.substrateId}`}
                </Text>
                <VStack align="stretch" spacing={0.5}>
                  {group.samples.map((s) => (
                    <Button
                      key={s.sample_id}
                      variant="ghost"
                      size="sm"
                      justifyContent="space-between"
                      fontWeight="500"
                      px={2}
                      isActive={s.sample_id === selected}
                      aria-current={s.sample_id === selected ? "true" : undefined}
                      _active={{ bg: "accent.subtle", color: "accent.solid" }}
                      onClick={() => onSelect(s.sample_id)}
                    >
                      <Text as="span" noOfLines={1}>
                        {sampleLabel(s)}
                        {s.position_mm != null && (
                          <Text as="span" color="text.muted" fontWeight="400">
                            {" "}
                            · {s.position_mm} mm
                          </Text>
                        )}
                      </Text>
                      <Badge colorScheme={STATE_SCHEME[s.state ?? ""] ?? "gray"} fontSize="0.6rem">
                        {s.state}
                      </Badge>
                    </Button>
                  ))}
                </VStack>
              </Box>
            ))}
            {page?.has_more && (
              <Text fontSize="xs" color="text.muted" px={2}>
                Showing {samples.data?.samples?.length} of {page.total}. Narrow the search to see the rest.
              </Text>
            )}
          </VStack>
        )}
      </Box>
    </VStack>
  );
};

export default SampleList;
