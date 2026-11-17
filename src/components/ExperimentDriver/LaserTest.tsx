import { useEffect, useRef, useState } from "react";
import { Badge, Box, Button, Flex, HStack, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ExperimentDriverClient, LaserTest } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverStore from "../../stores/experimentDriver";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import Section from "./Section";

type Call = ReturnType<typeof useDriverCall>;

const TABULAR = { fontVariantNumeric: "tabular-nums" };
const HISTORY = 10;

const mj = (v: number | null | undefined) => (v == null ? "--" : `${v.toFixed(1)} mJ`);
const when = (t: number, withDate = false) =>
  new Date(t * 1000).toLocaleString(undefined, {
    ...(withDate ? { month: "short", day: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });

const testsKey = (host: string | null) => ["driver", host, "laser_tests"];

/** `list_laser_tests`, newest first; refetched when a test is recorded, from here or anywhere. */
const useLaserTests = () => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const up = useExperimentDriverNodeStore((s) => s.state.is_available);
  const pendingKind = useExperimentDriverNodeStore((s) => s.state.pending_confirmation?.kind ?? null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: testsKey(host),
    queryFn: () => new ExperimentDriverClient(transport!).list_laser_tests({ limit: HISTORY }),
    enabled: Boolean(transport) && up,
    staleTime: 60_000,
  });
  // A test opened by another console or the agent ends when its gate closes.
  const was = useRef(pendingKind);
  useEffect(() => {
    if (was.current === "laser_test" && pendingKind !== "laser_test") {
      client.invalidateQueries({ queryKey: testsKey(host) });
    }
    was.current = pendingKind;
  }, [pendingKind, client, host]);
  return query;
};

const TestLine = ({ test }: { test: LaserTest }) => (
  <Text fontSize="xs" sx={TABULAR}>
    {mj(test.source_mj)} at the source → {mj(test.meter_mj)} at the meter ·{" "}
    <Text as="span" fontWeight="600">
      ratio {test.ratio.toFixed(3)}
    </Text>
  </Text>
);

/**
 * The daily laser test: once a day before the first deposition, the excimer
 * fires into the energy meter at the exit port, and the meter / source ratio
 * it gives sets the pulse energy for the rest of the day. Under pld-service a
 * deposition's energy is refused without one.
 *
 * Start opens the `laser_test` prompt (the pending card above); firing and
 * entering the meter's average happen there.
 */
export const LaserTestSection = ({ locked }: { locked: boolean }) => {
  const call = useDriverCall();
  const tests = useLaserTests();
  const [showHistory, setShowHistory] = useState(false);
  const list = tests.data?.tests ?? [];
  const today = list.find((t) => t.today);
  const pending = useExperimentDriverNodeStore((s) => s.state.pending_confirmation?.kind === "laser_test");

  const start = (
    <Button
      size="xs"
      colorScheme={today ? undefined : "blue"}
      variant={today ? "ghost" : "solid"}
      isLoading={call.busy}
      isDisabled={!call.canOperate || locked}
      title={
        !call.canOperate
          ? "Operator access required"
          : locked
          ? "The driver is busy: answer the prompt or wait for the task first"
          : "Shutter closed, carousel to Clear, excimer at 21 kV in HV mode; then fire into the meter"
      }
      onClick={() => call.run((c) => c.begin_laser_test())}
    >
      {today ? "Test again" : "Start laser test"}
    </Button>
  );

  return (
    <Section title="Daily laser test">
      <VStack align="stretch" spacing={1}>
        {tests.isLoading ? (
          <Spinner size="xs" />
        ) : today ? (
          <Flex align="center" gap={2} flexWrap="wrap">
            <Badge colorScheme="green" variant="subtle" fontSize="0.65rem">
              today {when(today.tested_at)}
            </Badge>
            <TestLine test={today} />
            <Box ml="auto">{!pending && start}</Box>
          </Flex>
        ) : (
          <Flex align="center" gap={2} flexWrap="wrap">
            <Text fontSize="xs" color="status.warn">
              No laser test today: depositions can't set their energy until one is done.
            </Text>
            <Box ml="auto">{!pending && start}</Box>
          </Flex>
        )}
        {pending && (
          <Text fontSize="xs" color="text.muted">
            In progress: answer it in the prompt above.
          </Text>
        )}
        {list.length > 0 && (
          <Button size="xs" variant="link" alignSelf="flex-start" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide history" : `History (${list.length})`}
          </Button>
        )}
        {showHistory && (
          <VStack align="stretch" spacing={0}>
            {list.map((t) => (
              <Flex
                key={t.test_id}
                gap={2}
                fontSize="xs"
                py="2px"
                borderBottomWidth="1px"
                borderColor="panel.border"
                _last={{ borderBottomWidth: 0 }}
                sx={TABULAR}
              >
                <Text color="text.muted" flexShrink={0} whiteSpace="nowrap">
                  {when(t.tested_at, true)}
                </Text>
                <Text flex={1}>
                  {mj(t.source_mj)} → {mj(t.meter_mj)}
                </Text>
                <Text fontWeight="600">{t.ratio.toFixed(3)}</Text>
                <Text color="text.muted" w="64px" textAlign="right" title={t.actor ?? undefined}>
                  {t.fired_by === "lumi" ? "Lumi fired" : "by hand"}
                </Text>
              </Flex>
            ))}
          </VStack>
        )}
        {(call.error || tests.error) && (
          <Text fontSize="xs" color="status.error">
            {call.error ?? String(tests.error)}
          </Text>
        )}
      </VStack>
    </Section>
  );
};

/**
 * The `laser_test` prompt: fire the 100-pulse train (a task, about 100 s,
 * stopped like a deposition) or fire by hand, then enter the meter's average.
 * The source energy is the excimer's own average while Lumi fired; after a
 * hand fire it is the laser's last reading unless typed in here.
 */
export const LaserTestPrompt = ({ call }: { call: Call }) => {
  const host = useTransportStore((s) => s.host);
  const client = useQueryClient();
  const firing = useExperimentDriverNodeStore((s) => s.state.current_task?.kind === "fire_laser_test");
  const fired = useExperimentDriverStore((s) =>
    [...s.results].reverse().find((r) => r.kind === "fire_laser_test")
  );
  const [meter, setMeter] = useState("");
  const [source, setSource] = useState("");
  const meterN = Number(meter);
  const sourceN = Number(source);
  const sourceOk = source.trim() === "" || (Number.isFinite(sourceN) && sourceN > 0);
  const valid = meter.trim() !== "" && Number.isFinite(meterN) && meterN > 0 && sourceOk;
  const firedSource = fired?.ok && typeof fired.data.source_mj === "number" ? fired.data.source_mj : null;

  const record = () =>
    call
      .run((c) => c.confirm_laser_test({ meter_mj: meterN, source_mj: source.trim() === "" ? null : sourceN }))
      .then((r) => r && client.invalidateQueries({ queryKey: testsKey(host) }));

  return (
    <VStack align="stretch" spacing={2}>
      <HStack spacing={2} flexWrap="wrap" rowGap={1}>
        <Button
          size="xs"
          colorScheme="orange"
          isLoading={firing}
          loadingText="Firing…"
          isDisabled={!call.canOperate || call.busy || firing}
          title="Fires the excimer: 100 pulses at 1 Hz into the meter, about 100 s"
          onClick={() => call.run((c) => c.fire_laser_test())}
        >
          Fire 100 pulses at 1 Hz
        </Button>
        <Text fontSize="xs" color="text.muted">
          or fire the laser yourself
        </Text>
      </HStack>
      {firedSource != null && (
        <Text fontSize="xs" sx={TABULAR}>
          Lumi fired: the excimer averaged {mj(firedSource)}.
        </Text>
      )}
      {fired && !fired.ok && fired.error && (
        <Text fontSize="xs" color="status.error">
          Firing ended: {fired.error}
        </Text>
      )}
      <HStack spacing={2} flexWrap="wrap" rowGap={1}>
        <Input
          size="xs"
          type="number"
          w="110px"
          aria-label="Energy meter average"
          placeholder="meter mJ"
          value={meter}
          onChange={(e) => setMeter(e.target.value)}
        />
        <Input
          size="xs"
          type="number"
          w="120px"
          aria-label="Source energy (optional)"
          placeholder="source mJ (optional)"
          title="Leave blank: the excimer's average while Lumi fired, or the laser's last reading after a hand fire"
          value={source}
          isInvalid={!sourceOk}
          onChange={(e) => setSource(e.target.value)}
        />
        <Button
          size="xs"
          colorScheme="blue"
          isLoading={call.busy}
          isDisabled={!call.canOperate || firing || !valid}
          onClick={record}
        >
          Record test
        </Button>
      </HStack>
    </VStack>
  );
};
