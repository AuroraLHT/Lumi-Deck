import { Alert, AlertIcon, Center, Grid, Text, VStack } from "@chakra-ui/react";

import useAppStore from "../../stores/app";
import useChamberPldNodeStore from "../../stores/nodes/chamberPld";
import useChamberPldStore from "../../stores/chamberPld";
import { useCanOperate } from "../../hooks/useChamberPldCall";
import HeaterControls from "./HeaterControls";
import LaserControls from "./LaserControls";
import MotionControls from "./MotionControls";
import RheedControls from "./RheedControls";
import SessionControls from "./SessionControls";
import { LoadLockControls, MainChamberControls } from "./VacuumControls";

/**
 * Operator controls for the chamber.pld driver -- acquire control, move axes,
 * drive the heater/gas/excimer, and the load lock/pumps. A companion to the
 * read-only `ChamberPldMain`, which stays mounted separately so viewers keep
 * the status view without these controls.
 *
 * Every button here sends one op and shows the `{ok, message}` it got back
 * inline; refusals (no control, an interlock, read-only hardware, ...) are
 * the backend's own words, not re-derived here.
 */
const ChamberPldControls = () => {
  const host = useAppStore((s) => s.selectedHost);
  const node = useChamberPldNodeStore((s) => s.state);
  const chamber = useChamberPldStore((s) => s.chamber);
  const canOperate = useCanOperate();

  if (!host) {
    return (
      <Center h="100%" minH="160px">
        <Text fontSize="sm" color="text.muted">
          Select a server to view the chamber.
        </Text>
      </Center>
    );
  }

  if (!node.is_available) {
    return (
      <Center h="100%" minH="160px">
        <Text fontSize="sm" color="text.muted">
          Chamber node is not running.
        </Text>
      </Center>
    );
  }

  const legacy = node.driver === "legacy-mi";

  return (
    <VStack align="stretch" spacing={2} p={2}>
      {legacy && (
        <Alert status="info" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          This chamber runs the legacy MI driver (--use-legacy-mi-mode). Every
          control below is refused -- see the MI Mode panel for live control.
        </Alert>
      )}

      {!legacy && node.read_only && (
        <Alert status="warning" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          pld-service was started without --allow-operations: every op below
          is refused.
        </Alert>
      )}

      {!legacy && !node.connected && (
        <Alert status="warning" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          pld-service is not answering every port -- ops may fail or act on
          stale readings.
        </Alert>
      )}

      {!canOperate && (
        <Alert status="info" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          Operator or admin access is needed to use these controls.
        </Alert>
      )}

      <SessionControls />

      {!chamber ? (
        <Center minH="120px">
          <Text fontSize="sm" color="text.muted">
            Waiting for chamber state…
          </Text>
        </Center>
      ) : (
        <Grid templateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={2}>
          <MainChamberControls />
          <LoadLockControls />
          <MotionControls />
          <HeaterControls />
          <LaserControls />
          <RheedControls />
        </Grid>
      )}
    </VStack>
  );
};

export default ChamberPldControls;
