import { useState } from "react";
import { Badge, Box, Button, Checkbox, Flex, HStack, Input, Progress, Select, Spinner, Text, VStack } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ExperimentDriverClient, RunSequence, SequenceInfo, SequenceLayer, SequenceRun } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import ConfirmButton from "../Controller/ConfirmButton";
import { isAgent } from "../ChamberPld/activity";
import Section from "./Section";

const TABULAR = { fontVariantNumeric: "tabular-nums" };
const LIVE = new Set(["starting", "running", "pausing", "paused"]);
const RUN_COLORS: Record<string, string> = {
  starting: "blue",
  running: "blue",
  pausing: "orange",
  paused: "orange",
  finished: "green",
  failed: "red",
  cancelled: "gray",
  unknown: "red",
};

const when = (t: number | null | undefined) =>
  t == null
    ? ""
    : new Date(t * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const listKey = (host: string | null) => ["driver", host, "sequences"];

// --- Steps, as a person reviews them -------------------------------------------

type Step = Record<string, unknown>;

const scalar = (v: unknown) => (typeof v === "number" || typeof v === "string" || typeof v === "boolean" ? String(v) : JSON.stringify(v));

/** pld.proto JSON names, read aloud; any other op shows as name and fields. */
const describeStep = (step: Step): string => {
  const [op, value] = Object.entries(step).find(([k]) => k !== "label") ?? ["?", undefined];
  const v = (value ?? {}) as Record<string, unknown>;
  const fields = () =>
    typeof value === "object" && value
      ? Object.entries(v)
          .map(([k, x]) => `${k} ${scalar(x)}`)
          .join(", ")
      : scalar(value);
  switch (op) {
    case "loop_start":
      return `Repeat ${scalar(value)}×`;
    case "loop_end":
      return "End repeat";
    case "wait_s":
      return `Wait ${scalar(value)} s`;
    case "pause":
      return `Pause until resumed${value ? `: ${scalar(value)}` : ""}`;
    case "fire_laser":
      return `Fire ${scalar(v.pulses)} pulses at ${scalar(v.rate_hz)} Hz${v.wait === false ? " (no wait)" : ""}`;
    case "meter_energy":
      return `Energy at the meter ${scalar(v.mj)} mJ (from today's laser test)`;
    case "mask":
      return `Mask to ${scalar(v.position)} mm${v.speed_mm_s ? ` at ${scalar(v.speed_mm_s)} mm/s` : ""}${
        v.wait === false ? " (no wait)" : ""
      }`;
    case "select_target":
      return `Target ${scalar(v.target)}${v.wait === false ? " (no wait)" : ""}`;
    case "wait_axis_idle":
      return `Wait until ${scalar(v.axis)} stops`;
    case "sample_shutter":
      return v.in_front ? "Shutter in front of the sample" : "Shutter away from the sample";
    default:
      return `${op.replace(/_/g, " ")}${value === undefined ? "" : `: ${fields()}`}`;
  }
};

/** Numbered as the run's `step` counts them (1-based), indented inside loops. */
const StepList = ({ steps, current }: { steps: Step[]; current?: number }) => {
  let depth = 0;
  return (
    <VStack align="stretch" spacing={0} maxH="240px" overflowY="auto" fontSize="xs" sx={TABULAR}>
      {steps.map((step, i) => {
        const op = Object.keys(step).find((k) => k !== "label");
        if (op === "loop_end") depth = Math.max(0, depth - 1);
        const indent = depth;
        if (op === "loop_start") depth += 1;
        const here = current === i + 1;
        const risky = op === "fire_laser" || op === "meter_energy";
        return (
          <Flex key={i} gap={2} py="1px" bg={here ? "blue.50" : undefined} _dark={here ? { bg: "blue.900" } : undefined}>
            <Text color="text.muted" w="24px" textAlign="right" flexShrink={0}>
              {i + 1}
            </Text>
            <Text pl={`${indent * 14}px`} flex={1} color={risky ? "status.warn" : undefined}>
              {describeStep(step)}
              {typeof step.label === "string" && step.label && (
                <Text as="span" color="text.muted">
                  {" "}
                  · {step.label}
                </Text>
              )}
            </Text>
          </Flex>
        );
      })}
    </VStack>
  );
};

// --- The run in progress ---------------------------------------------------------

/** Whose run it is: the sample and pixel it grows on (or a rehearsal), and its recording. */
const RunSample = ({ run }: { run: SequenceRun }) => (
  <Flex fontSize="xs" gap={2} flexWrap="wrap" align="center">
    {run.no_sample ? (
      <Badge variant="outline" fontSize="0.6rem" title="No substrate: no layers or growth records">
        rehearsal
      </Badge>
    ) : (
      <Text>
        {run.sample_name ?? (run.substrate_id != null ? `substrate #${run.substrate_id}` : "no sample recorded")}
        {run.pixel_index != null && ` · pixel ${run.pixel_index}`}
      </Text>
    )}
    {run.recording_name && (
      <Badge colorScheme="purple" variant="subtle" fontSize="0.6rem" title="run_sequence started this recording">
        recording {run.recording_name}
      </Badge>
    )}
  </Flex>
);

/** Grown so far, in order: material, pulses and rate, and the energy at the meter. */
const Layers = ({ layers }: { layers: SequenceLayer[] }) => (
  <VStack align="stretch" spacing={0} fontSize="xs" sx={TABULAR}>
    <Text fontSize="0.65rem" color="text.muted">
      Layers
    </Text>
    {layers.map((l, i) => (
      <Flex key={i} gap={2}>
        <Text color="text.muted" w="18px" textAlign="right">
          {i + 1}
        </Text>
        <Text fontWeight="600" w="80px" noOfLines={1} title={l.target_material ?? l.target_id}>
          {l.target_material ?? l.target_id}
        </Text>
        <Text flex={1}>
          {l.num_pulse} pulses at {l.laser_repetition_rate} Hz
          {l.meter_mj != null && ` · ${l.meter_mj} mJ`}
        </Text>
        {l.experiment_id != null && <Text color="text.muted">exp {l.experiment_id}</Text>}
      </Flex>
    ))}
  </VStack>
);

/** The driver's last run: progress, the step it is on, and pause / resume / cancel while it lives. */
const RunStatus = ({ run }: { run: SequenceRun }) => {
  const call = useDriverCall();
  const state = run.state ?? "";
  const live = LIVE.has(state);
  const pct = run.total ? Math.min(100, ((run.done ?? 0) / run.total) * 100) : 0;
  return (
    <Box borderWidth="1px" borderColor={live ? "blue.300" : "panel.border"} borderRadius="md" p={2}>
      <VStack align="stretch" spacing={1}>
        <Flex align="center" gap={2} fontSize="xs" flexWrap="wrap">
          <Text fontWeight="600">
            {run.name} v{run.version}
          </Text>
          <Badge colorScheme={RUN_COLORS[state] ?? "gray"} variant={live ? "solid" : "subtle"} fontSize="0.6rem">
            {state || "?"}
          </Badge>
          <Text color="text.muted" sx={TABULAR}>
            step {run.step ?? "-"}/{run.steps ?? "-"}
            {run.loops ? ` · loops ${run.loops}` : ""}
          </Text>
          {live && (
            <HStack ml="auto" spacing={1}>
              {state === "paused" ? (
                <Button
                  size="xs"
                  colorScheme="blue"
                  isLoading={call.busy}
                  isDisabled={!call.canOperate}
                  onClick={() => call.run((c) => c.resume_sequence())}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="outline"
                  isLoading={call.busy}
                  isDisabled={!call.canOperate || state === "pausing"}
                  title={run.pause_note}
                  onClick={() => call.run((c) => c.pause_sequence())}
                >
                  Pause
                </Button>
              )}
              <ConfirmButton
                size="xs"
                colorScheme="red"
                isDisabled={!call.canOperate}
                confirmLabel="Cancel this run? A fire train stops; a move or ramp under way carries on; nothing is undone."
                onConfirm={() => call.run((c) => c.cancel_sequence()).then(() => undefined)}
              >
                Cancel
              </ConfirmButton>
            </HStack>
          )}
        </Flex>
        <RunSample run={run} />
        {state === "unknown" && (
          <Text fontSize="xs" color="status.error" fontWeight="600">
            Lumi lost track of this run: pld-service stopped answering or restarted. Check the chamber; a fire or move
            may still be under way (Stop firing in the chamber panel works without control).
          </Text>
        )}
        <Progress value={pct} size="xs" borderRadius="sm" colorScheme={RUN_COLORS[state] ?? "gray"} isAnimated={live} />
        <Flex fontSize="xs" gap={2}>
          <Text flex={1} noOfLines={2} title={run.message}>
            {run.label && <Text as="span" fontWeight="600">{run.label}: </Text>}
            {run.message}
          </Text>
          <Text color="text.muted" flexShrink={0} sx={TABULAR}>
            {run.done ?? 0}/{run.total ?? "?"} ops
          </Text>
        </Flex>
        {(run.layers?.length ?? 0) > 0 && <Layers layers={run.layers!} />}
        {state === "pausing" && run.pause_note && (
          <Text fontSize="0.65rem" color="text.muted">
            {run.pause_note}
          </Text>
        )}
        {call.error && (
          <Text fontSize="xs" color="status.error">
            {call.error}
          </Text>
        )}
      </VStack>
    </Box>
  );
};

// --- One sequence: versions, review, approve, run --------------------------------

const Approval = ({ info }: { info: SequenceInfo }) =>
  info.approved_at ? (
    <Badge colorScheme="green" variant="subtle" fontSize="0.6rem" title={`Approved ${when(info.approved_at)}`}>
      approved by {info.approved_by}
    </Badge>
  ) : (
    <Badge colorScheme="orange" variant="subtle" fontSize="0.6rem">
      needs approval
    </Badge>
  );

const SequenceRow = ({
  versions,
  locked,
  run,
}: {
  /** Newest first. */
  versions: SequenceInfo[];
  locked: boolean;
  run: SequenceRun | null;
}) => {
  const running = Boolean(run && LIVE.has(run.state ?? ""));
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const client = useQueryClient();
  const call = useDriverCall();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(versions[0].version);
  const info = versions.find((v) => v.version === version) ?? versions[0];
  const ref = { name: info.name, version: info.version, content_hash: info.content_hash };
  const substrateId = useExperimentDriverNodeStore((s) => s.state.substrate_id);
  const pixel = useExperimentDriverNodeStore((s) => s.state.current_pixel_index);
  const project = useExperimentDriverNodeStore((s) => s.state.project_name);
  const [noSample, setNoSample] = useState(false);
  const [record, setRecord] = useState(false);
  const [recordProject, setRecordProject] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const recordAs = (recordProject ?? project ?? "").trim();
  const hasSample = substrateId != null && Boolean(project);

  const detail = useQuery({
    queryKey: ["driver", host, "sequence", info.name, info.version],
    queryFn: () => new ExperimentDriverClient(transport!).get_sequence({ name: info.name, version: info.version }),
    enabled: open && Boolean(transport),
    staleTime: Infinity, // a version never changes
  });
  const steps = (detail.data?.steps ?? []) as Step[];
  const refresh = () => client.invalidateQueries({ queryKey: listKey(host) });

  const runBlock = !call.canOperate
    ? "Operator access required"
    : !info.approved_at
    ? "A person has to approve this version first"
    : running
    ? "A sequence is already running"
    : locked
    ? "The driver is busy: answer the prompt or wait for the task first"
    : !noSample && !hasSample
    ? "No substrate and project loaded: load one, or run it as a rehearsal"
    : record && !recordAs
    ? "Name the recording's project"
    : undefined;
  const request: RunSequence = {
    ...ref,
    no_sample: noSample,
    record: record ? { project_name: recordAs, note: note.trim() || null } : null,
  };
  const where = noSample
    ? "as a rehearsal, with no sample"
    : `on substrate #${substrateId}${pixel != null ? `, pixel ${pixel}` : ""}`;

  return (
    <Box py="3px" borderBottomWidth="1px" borderColor="panel.border" _last={{ borderBottomWidth: 0 }}>
      <Flex align="center" gap={2} fontSize="xs" flexWrap="wrap" rowGap={1}>
        <Button size="xs" variant="link" fontWeight="600" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"} {info.name}
        </Button>
        {versions.length > 1 ? (
          <Select
            size="xs"
            w="auto"
            aria-label={`${info.name} version`}
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
          >
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                v{v.version}
                {v.latest ? " (latest)" : ""}
              </option>
            ))}
          </Select>
        ) : (
          <Text color="text.muted">v{info.version}</Text>
        )}
        <Approval info={info} />
        {info.fires && (
          <Badge colorScheme="red" variant="outline" fontSize="0.6rem">
            fires
          </Badge>
        )}
        {info.sets_energy && (
          <Badge variant="outline" fontSize="0.6rem" title="Has a meter_energy step: needs today's laser test">
            laser test
          </Badge>
        )}
        <Text color="text.muted" ml="auto" sx={TABULAR}>
          {info.num_steps} steps · {info.num_operations} ops
        </Text>
      </Flex>

      {open && (
        <VStack align="stretch" spacing={2} mt={1} pl={4}>
          {info.description && <Text fontSize="xs">{info.description}</Text>}
          <Text fontSize="0.65rem" color="text.muted">
            Saved {when(info.saved_at)}
            {info.saved_by ? ` by ${info.saved_by}` : ""}
            {isAgent(info.saved_by) ? " (the agent)" : ""} · {info.content_hash.slice(0, 12)}
          </Text>
          {detail.isLoading ? (
            <Spinner size="xs" />
          ) : (
            <StepList
              steps={steps}
              current={running && run?.name === info.name && run.version === info.version ? run.step : undefined}
            />
          )}
          <Flex gap={3} fontSize="xs" flexWrap="wrap" align="center" rowGap={1}>
            <Checkbox
              size="sm"
              isChecked={noSample}
              onChange={(e) => setNoSample(e.target.checked)}
              title="No substrate: no layers or growth records"
            >
              <Text fontSize="xs">Rehearsal (no sample)</Text>
            </Checkbox>
            {!noSample && (
              <Text color={hasSample ? "text.muted" : "status.warn"}>
                {hasSample
                  ? `Grows on substrate #${substrateId}${pixel != null ? `, pixel ${pixel}` : ""} (${project})`
                  : "No substrate loaded"}
              </Text>
            )}
          </Flex>
          <Flex gap={2} fontSize="xs" flexWrap="wrap" align="center" rowGap={1}>
            <Checkbox size="sm" isChecked={record} onChange={(e) => setRecord(e.target.checked)}>
              <Text fontSize="xs">Record this run</Text>
            </Checkbox>
            {record && (
              <>
                <Input
                  size="xs"
                  w="140px"
                  aria-label="Recording project"
                  placeholder="project"
                  value={recordProject ?? project ?? ""}
                  isInvalid={!recordAs}
                  onChange={(e) => setRecordProject(e.target.value)}
                />
                <Input
                  size="xs"
                  w="160px"
                  aria-label="Recording note"
                  placeholder="note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </>
            )}
          </Flex>
          <HStack spacing={2}>
            {!info.approved_at && (
              <ConfirmButton
                size="xs"
                colorScheme="green"
                isDisabled={!call.canOperate || steps.length === 0}
                title={call.canOperate ? undefined : "Operator access required"}
                confirmLabel={`Approve ${info.name} v${info.version}? You have reviewed these ${info.num_steps} steps; from now on this exact version can run without anyone.`}
                onConfirm={() =>
                  call.run((c) => c.approve_sequence(ref)).then((r) => {
                    if (r) refresh();
                  })
                }
              >
                Approve
              </ConfirmButton>
            )}
            <ConfirmButton
              size="xs"
              colorScheme="blue"
              isDisabled={runBlock != null}
              title={runBlock}
              confirmLabel={`Run ${info.name} v${info.version} (${info.num_operations} operations${
                info.fires ? ", fires the laser" : ""
              }) ${where}${record ? `, recorded to ${recordAs}` : ""}? pld-service refuses other operations while it runs.`}
              onConfirm={() => call.run((c) => c.run_sequence(request)).then(() => undefined)}
            >
              Run
            </ConfirmButton>
          </HStack>
          {call.error && (
            <Text fontSize="xs" color="status.error">
              {call.error}
            </Text>
          )}
        </VStack>
      )}
    </Box>
  );
};

/**
 * Step lists pld-service runs on its own, with a master pause / resume /
 * cancel. A person reviews each version once and approves it; after that it
 * runs without anyone. Any edit is a new version, unapproved. The agent can
 * save and run but never approve, so it asks a person to approve here.
 */
const SequencesSection = ({ locked }: { locked: boolean }) => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const up = useExperimentDriverNodeStore((s) => s.state.is_available);
  const run = useExperimentDriverNodeStore((s) => s.state.sequence);
  const list = useQuery({
    queryKey: listKey(host),
    queryFn: () => new ExperimentDriverClient(transport!).list_sequences({}),
    enabled: Boolean(transport) && up,
    staleTime: 30_000,
  });
  const byName = new Map<string, SequenceInfo[]>();
  for (const s of list.data?.sequences ?? []) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);

  return (
    <Section title="Sequences">
      <VStack align="stretch" spacing={2}>
        {run && <RunStatus run={run} />}
        {list.isLoading ? (
          <Spinner size="xs" />
        ) : byName.size === 0 ? (
          <Text fontSize="xs" color="text.muted">
            No sequences saved yet.
          </Text>
        ) : (
          <VStack align="stretch" spacing={0}>
            {[...byName.values()].map((versions) => (
              <SequenceRow key={versions[0].name} versions={versions} locked={locked} run={run} />
            ))}
          </VStack>
        )}
        <Flex justify="space-between" align="center">
          <Text fontSize="0.65rem" color="text.muted">
            Saved by the agent or over the API; approve here.
          </Text>
          <Button size="xs" variant="ghost" onClick={() => list.refetch()} isLoading={list.isFetching}>
            Refresh
          </Button>
        </Flex>
        {list.error && (
          <Text fontSize="xs" color="status.error">
            {String(list.error)}
          </Text>
        )}
      </VStack>
    </Section>
  );
};

export default SequencesSection;
