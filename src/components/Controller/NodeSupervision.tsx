import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Select,
  Text,
  useToast,
} from "@chakra-ui/react";

import { SystemSupervisorClient } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useSupervisorHosts from "../../hooks/useSupervisorHosts";

/**
 * Admin-only "start a node" control. Discovers hosts and their spawnable node
 * types from the supervisor and spawns one. Kill/restart of existing nodes live
 * on each node row; this covers bringing a new one up. Now reachable because the
 * backend `admin` role was added to policy.ROLES.
 */
const NodeSupervision = () => {
  const transport = useTransportStore((s) => s.transport);
  const { hosts, isLoading, error, refresh } = useSupervisorHosts(
    Boolean(transport)
  );
  const toast = useToast();

  const [host, setHost] = useState("");
  const [node, setNode] = useState("");
  const [spawning, setSpawning] = useState(false);

  const availableNodes = useMemo(
    () => hosts.find((h) => h.host === host)?.available_nodes ?? [],
    [hosts, host]
  );

  const handleSpawn = async () => {
    if (!transport || !host || !node) return;
    setSpawning(true);
    try {
      await new SystemSupervisorClient(transport).spawn({ host, node });
      toast({
        title: `Starting ${node} on ${host}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      setNode("");
      refresh();
    } catch (err) {
      toast({
        title: `Could not start ${node}`,
        description: err instanceof Error ? err.message : String(err),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSpawning(false);
    }
  };

  return (
    <Box
      borderWidth="1px"
      borderColor="panel.border"
      borderRadius="md"
      bg="panel.bg"
      p={3}
    >
      <Text fontSize="sm" fontWeight="semibold" color="text.primary" mb={2}>
        Start a node
      </Text>

      {error ? (
        <Text fontSize="xs" color="status.error">
          Supervisor unavailable: {error.message}
        </Text>
      ) : (
        <Flex gap={2} wrap="wrap" align="center">
          <Select
            size="sm"
            maxW="200px"
            placeholder="Host"
            value={host}
            isDisabled={isLoading || hosts.length === 0}
            onChange={(e) => {
              setHost(e.target.value);
              setNode("");
            }}
          >
            {hosts.map((h) => (
              <option key={h.host} value={h.host}>
                {h.host}
              </option>
            ))}
          </Select>

          <Select
            size="sm"
            maxW="200px"
            placeholder="Node"
            value={node}
            isDisabled={!host || availableNodes.length === 0}
            onChange={(e) => setNode(e.target.value)}
          >
            {availableNodes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>

          <Button
            size="sm"
            colorScheme="green"
            isDisabled={!host || !node}
            isLoading={spawning}
            loadingText="Starting"
            onClick={handleSpawn}
          >
            Start
          </Button>
        </Flex>
      )}
    </Box>
  );
};

export default NodeSupervision;
