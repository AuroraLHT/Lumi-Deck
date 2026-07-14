import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Center,
  HStack,
  Icon,
  Image,
  Select,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCamera, LuCameraOff, LuRefreshCw } from "react-icons/lu";

import useAppStore from "../../stores/app";
import useAuthStore, { withAuthToken } from "../../stores/auth";

type StreamState = "idle" | "connecting" | "live" | "error";

const QUALITY_OPTIONS = [
  { label: "Low", value: 45 },
  { label: "Medium", value: 70 },
  { label: "High", value: 90 },
];

/**
 * Live view of the chamber webcam.
 *
 * The backend serves this as MJPEG (`multipart/x-mixed-replace`), so the browser
 * decodes it natively in an <img> -- no Media Source Extensions, no fragment
 * cache, no WebSocket. The tradeoff is that we get no frame metadata, which is
 * fine because this feed is only ever watched, never analysed.
 *
 * The stream is only mounted while `streaming` is true. Leaving an MJPEG
 * connection open holds a RabbitMQ consumer and a JPEG encoder busy on the
 * server for as long as the tab lives, so an idle panel should not be paying it.
 */
const ChamberCameraMain = () => {
  const host = useAppStore((s) => s.selectedHost);
  const token = useAuthStore((s) => s.token);

  const [streaming, setStreaming] = useState(true);
  const [state, setState] = useState<StreamState>("idle");
  const [quality, setQuality] = useState(70);
  // Bumped to force the browser to drop a dead connection and re-request. Without
  // it, re-setting the same src is a no-op and "Retry" would do nothing.
  const [attempt, setAttempt] = useState(0);

  const imgRef = useRef<HTMLImageElement>(null);

  const src = useMemo(() => {
    if (!host || !token || !streaming) return "";
    return withAuthToken(
      `http://${host}/chamber/cam/live?quality=${quality}&_=${attempt}`
    );
  }, [host, token, streaming, quality, attempt]);

  useEffect(() => {
    setState(src ? "connecting" : "idle");
  }, [src]);

  // Detach the stream on unmount so the server-side consumer is released
  // promptly rather than waiting for GC to collect the <img>.
  useEffect(() => {
    const img = imgRef.current;
    return () => {
      if (img) img.src = "";
    };
  }, []);

  const retry = () => setAttempt((n) => n + 1);

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
          <Select
            size="xs"
            width="90px"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            aria-label="Stream quality"
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

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
        {src && (
          <Image
            ref={imgRef}
            src={src}
            alt="Chamber camera live view"
            onLoad={() => setState("live")}
            onError={() => setState("error")}
            width="100%"
            height="100%"
            objectFit="contain"
            draggable={false}
          />
        )}

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
