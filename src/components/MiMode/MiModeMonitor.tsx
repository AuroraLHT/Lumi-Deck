import { useEffect, useMemo, useState } from "react";
import { Box, Flex, Stack, Text, Tooltip } from "@chakra-ui/react";

import useMiModeStore from "../../stores/miMode";
import useMIModeNodeStore from "../../stores/nodes/miMode";
import { describeExecution } from "./executionState";
import ExecutionRow from "./ExecutionRow";

/**
 * What MI mode is running, live.
 *
 * Two sources, deliberately, because neither alone is the whole truth:
 *
 * - The **node's heartbeat** (`useNodeStates` -> `useMIModeNodeStore`) says which
 *   script the node considers current and how many are still queued. It is the
 *   node's own accounting, but it arrives on a 2s tick and carries no history.
 * - The **`execution` update channel** (`useMiModeStream` -> `useMiModeStore`)
 *   arrives the instant a script changes state and is the only place a
 *   COMPLETED or ABORTED is ever visible -- the node deletes an execution as it
 *   finishes, so history exists nowhere else.
 *
 * The active run is picked from the stream (fresher, sub-second) and the
 * heartbeat's `current_execution` is used only to break ties, so the panel never
 * lags the chamber by a heartbeat.
 *
 * ## Scope: this panel reports MI, not the chamber
 *
 * MI reports a script done when PASCAL has finished *reading* it, and the
 * setpoint commands return immediately by design (`pascal/sim/runner.py:103`), so
 * a ten-minute ramp shows as done within a second of being submitted. That is
 * MI's honest answer and this panel gives it unchanged -- the labels say "script",
 * not "chamber". Whether the chamber has actually arrived is a chamber-log
 * question, and the Monitor panel is where the log is plotted. Inferring it here
 * from the script text was tried and removed: a setpoint can be superseded,
 * abandoned by its controller being switched off, or read back off a column that
 * is not the one the loop closes on, and each of those turns the inference into a
 * confident wrong answer.
 */
const MiModeMonitor = () => {
  const executions = useMiModeStore((s) => s.executions);
  const lastUpdateAt = useMiModeStore((s) => s.lastUpdateAt);

  const isAvailable = useMIModeNodeStore((s) => s.state.is_available);
  const isRunning = useMIModeNodeStore((s) => s.state.is_running);
  const currentExecution = useMIModeNodeStore((s) => s.state.current_execution);
  const queueDepth = useMIModeNodeStore((s) => s.state.num_executions);

  const [expanded, setExpanded] = useState<string | null>(null);

  // Newest first: the thing you opened the panel to see should not be at the
  // bottom of a scroll.
  const ordered = useMemo(() => [...executions].reverse(), [executions]);

  const active = useMemo(() => {
    const live = ordered.find((e) => describeExecution(e).isActive);
    if (live) return live;
    // Nothing in the stream looks active yet -- fall back to whatever the
    // heartbeat named, which covers the window before the first transition.
    return ordered.find((e) => e.commands_uuid === currentExecution) ?? null;
  }, [ordered, currentExecution]);

  // Follow the run: opening the panel mid-growth should show the script that is
  // executing, not require a click to find it. Only auto-expands when the
  // *active* execution changes, so a manual selection is not fought over.
  useEffect(() => {
    if (active) setExpanded(active.commands_uuid);
  }, [active?.commands_uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = !isAvailable
    ? "Chamber node offline"
    : !isRunning
      ? "MI mode not serving"
      : active
        ? // The label is already a verb phrase ("Running", "Loading"); prefixing
          // it with another one produced "Running — running".
          describeExecution(active).label
        : "Idle";

  const statusColor = !isAvailable
    ? "status.error"
    : !isRunning
      ? "status.warn"
      : active
        ? "status.ok"
        : "status.idle";

  // Queued *behind* the active one. `num_executions` counts what the node still
  // holds -- queued plus running -- so the running one has to come back off.
  const pending = Math.max(0, queueDepth - (active ? 1 : 0));

  return (
    <Stack spacing={3}>
      <Flex
        align="center"
        gap={2}
        px={2.5}
        py={2}
        borderWidth="1px"
        borderColor="panel.border"
        borderRadius="md"
        bg="panel.bgElevated"
        minW={0}
      >
        <Box w="8px" h="8px" borderRadius="full" bg={statusColor} flexShrink={0} />
        <Text fontSize="sm" fontWeight="600" color="text.primary" noOfLines={1} flex="1">
          {statusLabel}
        </Text>

        {isAvailable && isRunning && (
          <Tooltip
            label={
              pending > 0
                ? "Scripts submitted but not yet started"
                : "Nothing waiting behind the current script"
            }
            openDelay={400}
          >
            <Text fontSize="xs" color="text.secondary" flexShrink={0}>
              {pending > 0 ? `${pending} queued` : "queue empty"}
            </Text>
          </Tooltip>
        )}
      </Flex>

      {ordered.length === 0 ? (
        <Box px={2.5} py={4}>
          <Text fontSize="sm" color="text.secondary">
            No executions yet.
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            {isAvailable
              ? "Scripts appear here as soon as the chamber picks them up."
              : "Waiting for the chamber node to join the bus."}
          </Text>
        </Box>
      ) : (
        <Stack spacing={2}>
          {ordered.map((execution) => (
            <ExecutionRow
              key={execution.commands_uuid}
              execution={execution}
              emphasised={execution.commands_uuid === active?.commands_uuid}
              isExpanded={expanded === execution.commands_uuid}
              onToggle={() =>
                setExpanded((current) =>
                  current === execution.commands_uuid ? null : execution.commands_uuid
                )
              }
            />
          ))}
        </Stack>
      )}

      {/* History is the browser's, not the server's -- say so, so nobody reads a
          short list as "the chamber only ran three scripts today". */}
      {ordered.length > 0 && (
        <Text fontSize="0.65rem" color="text.muted">
          {lastUpdateAt
            ? `Last update ${new Date(lastUpdateAt).toLocaleTimeString()} · history is kept in this browser since it connected`
            : "History is kept in this browser since it connected"}
        </Text>
      )}
    </Stack>
  );
};

export default MiModeMonitor;
