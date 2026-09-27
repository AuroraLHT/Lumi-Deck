import { useCallback } from "react";
import {
  Badge,
  Box,
  Flex,
  HStack,
  Heading,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useSearchParams } from "react-router-dom";

import { useSampleDetail, useSubstrates } from "../../hooks/useHistory";
import SampleList, { SampleFilter } from "./SampleList";
import SampleOverview from "./SampleOverview";
import MeasurementsTab from "./MeasurementsTab";
import ProcessTimeline from "./ProcessTimeline";
import RecordingViewer from "./RecordingViewer";
import ChamberLogHistory from "./ChamberLogHistory";
import { formatTime, STATE_SCHEME } from "./history";

const TABS = ["overview", "measurements", "process", "rheed", "log"] as const;

const numberParam = (value: string | null) => {
  const n = value === null ? NaN : Number(value);
  return Number.isInteger(n) ? n : null;
};

const panelStyle = {
  bg: "panel.bg",
  border: "1px solid",
  borderColor: "panel.border",
  borderRadius: "xl",
} as const;

/**
 * What past growths left behind, one sample at a time: its record and layer
 * stack, the step journal that made it, the RHEED recordings and the chamber
 * log over the same hours.
 *
 * Everything the page shows is in the URL (`?sample=23&tab=rheed`), so a view
 * can be linked and the back button walks the samples looked at.
 */
const HistoryPage = () => {
  const [params, setParams] = useSearchParams();

  const sampleId = numberParam(params.get("sample"));
  const tab = Math.max(0, TABS.indexOf(params.get("tab") as (typeof TABS)[number]));
  const filter: SampleFilter = {
    substrateId: numberParam(params.get("substrate")),
    state: params.get("state"),
    search: params.get("q") ?? "",
  };

  const update = useCallback(
    (changes: Record<string, string | number | null>, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace }
      ),
    [setParams]
  );

  // Filters rewrite the entry in place; picking a sample is a step back can undo.
  const onFilter = useCallback(
    (f: SampleFilter) => update({ substrate: f.substrateId, state: f.state, q: f.search }, true),
    [update]
  );

  const detail = useSampleDetail(sampleId);
  const substrates = useSubstrates();
  const sample = detail.data?.sample ?? null;
  const substrate = substrates.data?.substrates?.find((s) => s.substrate_id === sample?.substrate_id);

  return (
    <Flex
      gap={3}
      direction={{ base: "column", lg: "row" }}
      h={{ lg: "calc(100vh - 72px)" }}
      minH={0}
    >
      <Box
        {...panelStyle}
        p={3}
        w={{ base: "100%", lg: "300px" }}
        flexShrink={0}
        h={{ base: "320px", lg: "100%" }}
      >
        <SampleList
          filter={filter}
          onFilter={onFilter}
          selected={sampleId}
          onSelect={(id) => update({ sample: id })}
        />
      </Box>

      <Box {...panelStyle} flex={1} minW={0} minH={0} display="flex" flexDirection="column">
        {sampleId === null ? (
          <Flex flex={1} align="center" justify="center" p={8}>
            <Text color="text.muted">Pick a sample to see how it was grown.</Text>
          </Flex>
        ) : detail.isPending && detail.nodeUp ? (
          <HStack p={6} color="text.muted">
            <Spinner size="sm" />
            <Text fontSize="sm">Loading sample…</Text>
          </HStack>
        ) : !sample ? (
          <Text p={6} fontSize="sm" color={detail.isError ? "status.error" : "text.muted"}>
            {detail.isError
              ? detail.error.message
              : !detail.nodeUp
              ? "The experiment node is not running."
              : `No sample ${sampleId}.`}
          </Text>
        ) : (
          <>
            <Box px={4} pt={3} pb={2}>
              <HStack spacing={3} flexWrap="wrap" rowGap={1}>
                <Heading size="md">{sample.sample_name ?? `Sample ${sample.sample_id}`}</Heading>
                <Badge colorScheme={STATE_SCHEME[sample.state ?? ""] ?? "gray"}>{sample.state}</Badge>
              </HStack>
              <Text fontSize="sm" color="text.secondary" mt={0.5}>
                {substrate?.substrate_name ?? `Substrate ${sample.substrate_id}`}
                {substrate?.materials && ` · ${substrate.materials}`}
                {substrate?.orientation && ` (${substrate.orientation})`}
                {sample.pixel_index != null && ` · position ${sample.pixel_index}`}
                {sample.position_mm != null && ` at ${sample.position_mm} mm`}
                {" · registered "}
                {formatTime(sample.created_at)}
              </Text>
            </Box>

            <Tabs
              index={tab}
              onChange={(i) => update({ tab: i === 0 ? null : TABS[i] }, true)}
              isLazy
              size="sm"
              colorScheme="blue"
              display="flex"
              flexDirection="column"
              flex={1}
              minH={0}
            >
              <TabList px={3}>
                <Tab>Overview</Tab>
                <Tab>Measurements</Tab>
                <Tab>Process</Tab>
                <Tab>RHEED</Tab>
                <Tab>Chamber log</Tab>
              </TabList>
              <TabPanels flex={1} minH={0} overflowY="auto">
                <TabPanel>
                  <SampleOverview sampleId={sample.sample_id} layers={detail.data?.layers ?? []} notes={sample.notes} />
                </TabPanel>
                <TabPanel>
                  <MeasurementsTab
                    sampleId={sample.sample_id}
                    sampleName={sample.sample_name ?? `Sample ${sample.sample_id}`}
                  />
                </TabPanel>
                <TabPanel>
                  <ProcessTimeline sampleId={sample.sample_id} />
                </TabPanel>
                <TabPanel>
                  <RecordingViewer sampleId={sample.sample_id} />
                </TabPanel>
                <TabPanel>
                  <ChamberLogHistory sampleId={sample.sample_id} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </>
        )}
      </Box>
    </Flex>
  );
};

export default HistoryPage;
