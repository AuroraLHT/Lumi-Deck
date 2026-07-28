import { useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCamera, LuCameraOff, LuRefreshCw } from "react-icons/lu";

import useAppStore from "../../stores/app";
import useChamberCamera from "../../hooks/useChamberCamera";

/**
 * Live view of the chamber webcam.
 *
 * Frames arrive over the shared LumiTransport as raw NumPy arrays and are
 * blitted onto a canvas by `useChamberCamera` -- see there for why this cannot
 * be an <img>. Pausing unsubscribes, which is what actually stops the bytes;
 * the capability itself keeps running for other viewers.
 */
const ChamberCameraMain = () => {
  const host = useAppStore((s) => s.selectedHost);

  const [streaming, setStreaming] = useState(true);
  // Bumped by "Retry" to force the subscription effect to tear down and re-run.
  const [attempt, setAttempt] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useChamberCamera(canvasRef, streaming);

  const retry = () => {
    setStreaming(false);
    setAttempt((n) => n + 1);
    // Re-enable on the next tick so the effect fully unsubscribes first.
    setTimeout(() => setStreaming(true), 0);
  };

  if (!host) {
    return (
      <Center h="100%" minH="180px">
        <Text fontSize="sm" color="text.muted">
          Select a server to view the chamber camera.
        </Text>
      </Center>
    );
  }

  return (
    <VStack align="stretch" spacing={2} h="100%">
      <HStack justify="space-between" flexShrink={0}>
        <HStack spacing={2}>
          <Badge
            variant="subtle"
            colorScheme={
              state === "live" ? "green" : state === "error" ? "red" : "gray"
            }
            display="flex"
            alignItems="center"
            gap={1}
          >
            <Box
              w="6px"
              h="6px"
              borderRadius="full"
              bg={
                state === "live"
                  ? "status.ok"
                  : state === "error"
                  ? "status.error"
                  : "status.idle"
              }
            />
            {state === "live"
              ? "Live"
              : state === "connecting"
              ? "Connecting"
              : state === "error"
              ? "Offline"
              : "Paused"}
          </Badge>
        </HStack>

        <HStack spacing={1} className="no-drag">
          <Button
            size="xs"
            variant="panelGhost"
            leftIcon={<Icon as={streaming ? LuCameraOff : LuCamera} />}
            onClick={() => setStreaming((s) => !s)}
          >
            {streaming ? "Pause" : "Start"}
          </Button>
        </HStack>
      </HStack>

      <Box
        flex="1"
        minH="0"
        position="relative"
        borderRadius="lg"
        overflow="hidden"
        bg="black"
        // A webcam frame is 4:3; without this the panel body collapses to zero
        // height before the first frame arrives and the image never shows.
        sx={{ aspectRatio: "4 / 3" }}
      >
        <canvas
          key={attempt}
          ref={canvasRef}
          aria-label="Chamber camera live view"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: streaming ? "block" : "none",
          }}
        />

        {state === "connecting" && (
          <Center position="absolute" inset={0} bg="blackAlpha.600">
            <VStack spacing={2}>
              <Spinner size="sm" color="accent.solid" />
              <Text fontSize="xs" color="whiteAlpha.800">
                Waiting for frames…
              </Text>
            </VStack>
          </Center>
        )}

        {state === "error" && (
          <Center position="absolute" inset={0} bg="blackAlpha.700">
            <VStack spacing={3} px={4} textAlign="center">
              <Icon as={LuCameraOff} boxSize={6} color="status.error" />
              <Text fontSize="sm" color="whiteAlpha.900">
                Chamber camera is not responding.
              </Text>
              <Text fontSize="xs" color="whiteAlpha.600">
                Check that the Pascal node is running with a camera attached.
              </Text>
              <Button
                size="xs"
                leftIcon={<Icon as={LuRefreshCw} />}
                onClick={retry}
                className="no-drag"
              >
                Retry
              </Button>
            </VStack>
          </Center>
        )}

        {!streaming && (
          <Center position="absolute" inset={0} bg="blackAlpha.700">
            <VStack spacing={2}>
              <Icon as={LuCamera} boxSize={6} color="whiteAlpha.700" />
              <Text fontSize="xs" color="whiteAlpha.700">
                Stream paused
              </Text>
            </VStack>
          </Center>
        )}
      </Box>
    </VStack>
  );
};

export default ChamberCameraMain;
