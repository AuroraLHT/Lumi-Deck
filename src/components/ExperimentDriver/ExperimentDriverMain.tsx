import { useEffect, useState } from "react";
import { Badge, Center, HStack, Spinner, Text, Tooltip, VStack } from "@chakra-ui/react";

import useAppStore from "../../stores/app";
import useExperimentDriverStore from "../../stores/experimentDriver";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import CalibrationActions from "./CalibrationActions";
import MaskAutoAlign from "./MaskAutoAlign";
import PendingConfirmationCard from "./PendingConfirmationCard";
import { AUTO_ALIGN_KIND } from "./maskAlign";

const TASK_LABELS: Record<string, string> = {
  [AUTO_ALIGN_KIND]: "Mask auto-align",
  to_temperature: "Ramp to temperature",
  cool_down: "Cool down",
  perform_preablation: "Pre-ablation",
  perform_deposition: "Deposition",
  anneal: "Anneal",
};

const taskLabel = (kind: string | null) =>
  kind ? TASK_LABELS[kind] ?? kind : "Task";

/** Seconds since `startedAt` (epoch seconds, the backend's clock), ticking. */
const Elapsed = ({ startedAt }: { startedAt: number }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round(now / 1000 - startedAt));
  return <>{s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`}</>;
};

/**
 * The experiment driver: what it is doing, what it is waiting on, and the
 * calibration flows an operator starts from here.
 *
 * Top to bottom by urgency: a pending confirmation first, because the driver
 * is blocked until someone answers it; then the running task; then the
 * controls that start something new, locked while either of the above is
 * live -- the backend keeps one pending confirmation at a time and a second
 * `begin_*` would overwrite the first.
 *
 * Everything shown is shared: the gate, the task and the results are the
 * driver's, not this tab's, so a prompt opened by another console or an agent
 * over MCP shows up here and can be answered here.
 */
const ExperimentDriverMain = () => {
  const host = useAppStore((s) => s.selectedHost);
  const state = useExperimentDriverNodeStore((s) => s.state);
  const results = useExperimentDriverStore((s) => s.results);

  if (!host) {
    return (
      <Center h="100%" minH="160px">
        <Text fontSize="sm" color="text.muted">
          Select a server to use the experiment driver.
        </Text>
      </Center>
    );
  }

  if (!state.is_available) {
    return (
      <Center h="100%" minH="160px">
        <Text fontSize="sm" color="text.muted">
          Experiment driver node is not running.
        </Text>
      </Center>
    );
  }

  const { pending_confirmation: pending, current_task: task } = state;
  const locked = Boolean(pending || task);
  const down = Object.entries(state.deps_available)
    .filter(([, up]) => !up)
    .map(([name]) => name);
  const recent = [...results].reverse().filter((r) => r.kind !== AUTO_ALIGN_KIND).slice(0, 5);

  return (
    <VStack align="stretch" spacing={2} p={2}>
      <HStack spacing={2} fontSize="xs" flexWrap="wrap" rowGap={1}>
        <Badge variant="subtle" colorScheme={state.mode === "idle" ? "gray" : "blue"}>
          {state.mode ?? "unknown"}
        </Badge>
        {state.project_name && <Text>Project {state.project_name}</Text>}
        {state.substrate_id != null && (
          <Text color="text.muted">
            Substrate {state.substrate_id}
            {state.current_pixel_index != null &&
              ` · pixel ${state.current_pixel_index}/${state.num_pixel_positions ?? "?"}`}
          </Text>
        )}
        {state.is_recording && <Badge colorScheme="red">Recording</Badge>}
        {down.length > 0 && (
          <Tooltip label="The driver depends on these nodes; ops that use them will fail.">
            <Text color="status.warn">Down: {down.join(", ")}</Text>
          </Tooltip>
        )}
      </HStack>

      {state.error && (
        <Text fontSize="xs" color="status.error">
          {state.error}
        </Text>
      )}

      {pending && <PendingConfirmationCard key={pending.id} pending={pending} />}

      {task && (
        <HStack
          spacing={2}
          fontSize="xs"
          borderWidth="1px"
          borderColor="panel.border"
          borderRadius="md"
          p={2}
        >
          <Spinner size="xs" />
          <Text fontWeight="600">{taskLabel(task.kind)}</Text>
          <Text color="text.muted">
            running <Elapsed startedAt={task.started_at} />
          </Text>
        </HStack>
      )}

      <MaskAutoAlign locked={locked} />
      <CalibrationActions locked={locked} />

      {recent.length > 0 && (
        <VStack align="stretch" spacing={1}>
          <Text fontSize="xs" fontWeight="600" color="text.secondary">
            Recent tasks
          </Text>
          {recent.map((r, i) => (
            <HStack key={`${r.finishedAt}-${i}`} spacing={2} fontSize="xs">
              <Badge colorScheme={r.ok ? "green" : "red"}>{r.ok ? "ok" : "failed"}</Badge>
              <Text>{taskLabel(r.kind)}</Text>
              <Text color="text.muted">{new Date(r.finishedAt).toLocaleTimeString()}</Text>
              {r.error && (
                <Text color="status.error" noOfLines={1} title={r.error}>
                  {r.error}
                </Text>
              )}
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
};

export default ExperimentDriverMain;
