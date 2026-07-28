import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Switch,
  Text,
  Tooltip,
  VStack,
  useToast,
} from "@chakra-ui/react";

import useSystemRegistry from "../hooks/useSystemRegistry";
import useTransportStore from "../clients/transport";
import useAuthStore from "../stores/auth";
import ConfirmButton from "./Controller/ConfirmButton";
import NodeSupervision from "./Controller/NodeSupervision";
import {
  CapabilityPresence,
  NodeRecord,
  NodeStatus,
  SystemSupervisorClient,
} from "../generated/lumi";

// Node liveness -> a Chakra colour scheme for the status badge.
const STATUS_SCHEME: Record<NodeStatus, string> = {
  up: "green",
  down: "red",
  leaving: "yellow",
};

// A capability has a server-push stream (and therefore start/stop control verbs)
// only for these kinds; rpc/pubsub have no stream to toggle.
const isStreamable = (cap: CapabilityPresence): boolean =>
  cap.kind === "stream" || cap.kind === "duplex";

/** "just now" / "12s ago" / "3m ago" from an ISO timestamp. */
const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
};

const CapabilityRow = ({
  node,
  cap,
  canControl,
}: {
  node: NodeRecord;
  cap: CapabilityPresence;
  canControl: boolean;
}) => {
  const transport = useTransportStore((s) => s.transport);
  const toast = useToast();

  const streamable = isStreamable(cap);
  const serverStreaming = Boolean(cap.is_streaming);

  // Optimistic target while a start/stop is in flight and until the registry
  // reports the new state. The Switch is otherwise driven purely by the server's
  // is_streaming, which lags the click by a heartbeat (~1-2s), so without this
  // the control feels dead on click.
  const [pending, setPending] = useState<boolean | null>(null);

  useEffect(() => {
    // Server truth caught up to what we asked for -- drop the optimistic override.
    if (pending !== null && serverStreaming === pending) setPending(null);
  }, [serverStreaming, pending]);

  // Only a running node's stream can be toggled, the transport must be up, and
  // stopping a stream is server-wide -- so it is gated on an operator/admin role
  // (see AUTH note). Viewers see the state read-only.
  const disabled = !streamable || !cap.is_running || !transport || !canControl;
  const checked = pending ?? serverStreaming;

  const handleToggle = async (next: boolean) => {
    if (!transport) return;
    setPending(next); // immediate feedback
    // Every typed client's target is `${equipment}.${capability}` (e.g.
    // "rheed.camera"), so the control verb is addressable generically without a
    // per-capability client. This is what startStreaming()/stopStreaming() do.
    const target = `${node.equipment}.${cap.name}`;
    try {
      await transport.controlCall(target, next ? "start" : "stop");
      // `pending` clears once the registry reports is_streaming === next (above).
      // Safety net: revert the optimistic state if that report never arrives.
      window.setTimeout(
        () => setPending((p) => (p === next ? null : p)),
        8000
      );
    } catch (err) {
      setPending(null); // revert on failure
      toast({
        title: `Could not ${next ? "start" : "stop"} ${target}`,
        description: err instanceof Error ? err.message : String(err),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Flex align="center" justify="space-between" py={1}>
      <HStack spacing={2} minW={0}>
        <Text fontSize="sm" color="text.primary" noOfLines={1}>
          {cap.name}
        </Text>
        <Text fontSize="xs" color="text.muted">
          {cap.kind}
        </Text>
        {cap.is_running ? (
          <Badge colorScheme="green" variant="subtle" fontSize="0.65rem">
            running
          </Badge>
        ) : (
          <Badge colorScheme="gray" variant="subtle" fontSize="0.65rem">
            idle
          </Badge>
        )}
      </HStack>

      {streamable && (
        <HStack spacing={2} flexShrink={0}>
          {pending !== null && <Spinner size="xs" color="text.muted" />}
          <Tooltip
            isDisabled={canControl}
            label="Stopping a stream affects every connected user, so it needs an operator/admin role."
          >
            <Box>
              <Switch
                size="sm"
                colorScheme="green"
                isChecked={checked}
                isDisabled={disabled}
                onChange={(e) => handleToggle(e.target.checked)}
              />
            </Box>
          </Tooltip>
        </HStack>
      )}
    </Flex>
  );
};

const NodeRow = ({
  node,
  canControl,
  canSupervise,
}: {
  node: NodeRecord;
  canControl: boolean;
  canSupervise: boolean;
}) => {
  const transport = useTransportStore((s) => s.transport);
  const toast = useToast();

  // A dead node has no process to act on; the registry keeps showing it through
  // the grave period, but kill/restart only make sense while it is up/leaving.
  const isLive = node.status !== "down";

  const supervise = async (action: "kill" | "restart") => {
    if (!transport) return;
    const supervisor = new SystemSupervisorClient(transport);
    try {
      if (action === "kill") {
        await supervisor.kill({ instance_id: node.instance_id });
      } else {
        await supervisor.restart({ instance_id: node.instance_id });
      }
      toast({
        title: `${action === "kill" ? "Killing" : "Restarting"} ${node.equipment}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: `Could not ${action} ${node.equipment}`,
        description: err instanceof Error ? err.message : String(err),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box
      borderWidth="1px"
      borderColor="panel.border"
      borderRadius="md"
      bg="panel.bgElevated"
      p={3}
    >
      <Flex align="center" justify="space-between" mb={2} gap={2}>
        <HStack spacing={2} minW={0}>
          <Text fontWeight="semibold" color="text.primary" noOfLines={1}>
            {node.equipment}
          </Text>
          <Badge colorScheme={STATUS_SCHEME[node.status]} variant="solid">
            {node.status}
          </Badge>
          {node.contract_matches === false && (
            <Tooltip label="This node's contract differs from the backend's -- it may be running stale code.">
              <Badge colorScheme="orange" variant="subtle">
                contract mismatch
              </Badge>
            </Tooltip>
          )}
        </HStack>

        <HStack spacing={2} flexShrink={0}>
          {canSupervise && isLive && (
            <>
              <Button
                size="xs"
                variant="outline"
                onClick={() => supervise("restart")}
              >
                Restart
              </Button>
              <ConfirmButton
                size="xs"
                colorScheme="red"
                variant="outline"
                confirmLabel={`Kill ${node.equipment}?`}
                onConfirm={() => supervise("kill")}
              >
                Kill
              </ConfirmButton>
            </>
          )}
          <Text fontSize="xs" color="text.muted" whiteSpace="nowrap">
            {relativeTime(node.last_seen)}
          </Text>
        </HStack>
      </Flex>

    <Text fontSize="xs" color="text.secondary" mb={2} noOfLines={1}>
      {node.host} · pid {node.pid} · {node.instance_id}
    </Text>

    {node.capabilities && node.capabilities.length > 0 ? (
      <VStack align="stretch" spacing={0}>
        {node.capabilities.map((cap) => (
          <CapabilityRow
            key={cap.name}
            node={node}
            cap={cap}
            canControl={canControl}
          />
        ))}
      </VStack>
      ) : (
        <Text fontSize="xs" color="text.muted">
          No capabilities reported
        </Text>
      )}
    </Box>
  );
};

const MainController = () => {
  const { nodes, isLoading, error, status } = useSystemRegistry();
  const user = useAuthStore((s) => s.user);
  // A viewer is technically permitted to start/stop a stream, but stop is
  // server-wide, so the control is limited to operator/admin (guide §4). Fall
  // back to is_admin for sessions persisted before `role` existed.
  const canControl =
    user?.role === "operator" ||
    user?.role === "admin" ||
    Boolean(user?.is_admin);
  // Node supervision (spawn/kill/restart) is admin-only on the backend.
  const canSupervise = user?.role === "admin" || Boolean(user?.is_admin);

  return (
    <Box p={2}>
      {status !== "open" && (
        <Text fontSize="xs" color="text.muted" mb={2}>
          {status === "unauthorized"
            ? "Not authorized -- please log in again."
            : status === "connecting"
            ? "Connecting to server..."
            : "Disconnected -- retrying..."}
        </Text>
      )}

      {isLoading && nodes.length === 0 ? (
        <Flex align="center" gap={2} color="text.secondary" py={4}>
          <Spinner size="sm" />
          <Text fontSize="sm">Loading nodes...</Text>
        </Flex>
      ) : error && nodes.length === 0 ? (
        <Text fontSize="sm" color="status.error" py={4}>
          Could not load nodes: {error.message}
        </Text>
      ) : nodes.length === 0 ? (
        <Text fontSize="sm" color="text.muted" py={4}>
          No nodes reported.
        </Text>
      ) : (
        <VStack align="stretch" spacing={2}>
          {nodes.map((node) => (
            <NodeRow
              key={node.instance_id}
              node={node}
              canControl={canControl}
              canSupervise={canSupervise}
            />
          ))}
        </VStack>
      )}

      {canSupervise && status === "open" && (
        <Box mt={3}>
          <NodeSupervision />
        </Box>
      )}
    </Box>
  );
};

export default MainController;
