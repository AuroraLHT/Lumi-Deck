import { Box, Flex, FormLabel, Heading, Switch } from "@chakra-ui/react";
// import { useWebSocketStore } from "../stores/websocket";
// import useRHEED from "../hooks/useRHEED";
// import useLog from "../hooks/useChamberLog";
// import useDetection from "../hooks/useDetection";

import useWebSocketStore from "../stores/websocket";

import { ChangeEvent, useEffect } from "react";
import { useRef } from "react";
import useRheedNodeStore from "../stores/nodes/rheed";
import useChamberLogNodeStore from "../stores/nodes/chamberLog";
import useDetectorNodeStore from "../stores/nodes/detector";
// import useServerStore from "../stores/nodes/server";

import useRHEEDNode from "../hooks/useRHEEDNode";
import useDetectorNode from "../hooks/useDetectorNode";
import useChamberLogNode from "../hooks/useChamberLogNode";

const MainController = () => {
  const { isLoading: isRheedLoading } = useRHEEDNode();
  const { isLoading: isDetectorLoading } = useDetectorNode();
  const { isLoading: isChamberLogLoading } = useChamberLogNode();

  const rheedNodeState = useRheedNodeStore((s) => s.state);
  const setRHEEDNodeStreaming = useRheedNodeStore((s) => s.setStreaming);
  const chamberNodeState = useChamberLogNodeStore((s) => s.state);
  const setChamberNodeStreaming = useChamberLogNodeStore((s) => s.setStreaming);
  const detectorNodeState = useDetectorNodeStore((s) => s.state);
  const setDetectorNodeStreaming = useDetectorNodeStore((s) => s.setStreaming);
  // const StorageNode = useServerStore((s) => s.StorageNode);

  const rheedVideoSwitchRef = useRef<HTMLInputElement>(null);
  const rheedAISwitchRef = useRef<HTMLInputElement>(null);
  const chamberLogSwitchRef = useRef<HTMLInputElement>(null);

  // useEffect(() => {
  //   if (rheedVideoSwitchRef.current) {
  //     console.log("RHEED", rheedNodeState);
  //   }
  // }, [rheedNodeState]);

  // useEffect(() => {
  //   if (rheedAISwitchRef.current) {
  //     console.log("RHEED AI", RHEEDAINode);
  //   }
  // }, [RHEEDAINode]);

  // useEffect(() => {
  //   if (chamberLogSwitchRef.current) {
  //     console.log("Chamber", ChamberNode);
  //   }
  // }, [ChamberNode]);

  // const { sendMessage: sendRheedMessage } = useRHEED();
  // const { sendMessage: sendLogMessage } = useLog();
  // const { sendMessage: sendDetectionMessage } = useDetection();
  const rheedSocket = useWebSocketStore(s=>s.getWebSocket('rheed'));
  const logSocket = useWebSocketStore(s=>s.getWebSocket('log'));
  const detectionSocket = useWebSocketStore(s=>s.getWebSocket('detect'));
  // console.log(sendRheedMessage, sendLogMessage, sendDetectionMessage);


  const handleRheedVideoSwitch = (event: ChangeEvent<HTMLInputElement>) => {
    // console.log("RHEED video switch:", event.target.checked);
    if (rheedSocket && rheedSocket.socket.readyState == WebSocket.OPEN){
      rheedSocket.socket.send(event.target.checked ? "start_server" : "stop_server")
    }
    setRHEEDNodeStreaming(event.target.checked);
  };

  const handleRheedAISwitch = (event: ChangeEvent<HTMLInputElement>) => {
    // console.log("RHEED AI switch:", event.target.checked);
    if (detectionSocket && detectionSocket.socket.readyState == WebSocket.OPEN){
      detectionSocket.socket.send(event.target.checked ? "start_server" : "stop_server")
    }
    setDetectorNodeStreaming(event.target.checked);
  };

  const handleChamberLogSwitch = (event: ChangeEvent<HTMLInputElement>) => {
    // console.log("Chamber log switch", event.target.checked);
    if (logSocket && logSocket.socket.readyState == WebSocket.OPEN){
      logSocket.socket.send(event.target.checked ? "start_server" : "stop_server")
    }
    setChamberNodeStreaming(event.target.checked);
  };

  return (
    <Box p={5}>
      <Heading as="h1" mb={4} color="green.500">
        Server control
      </Heading>

      <Heading as="h3" mb={4}></Heading>

      <Flex
        direction={{
          base: "column",
          md: "row",
        }}
        alignItems={{
          base: "center",
          md: "flex-start",
        }}
        mb={4}
      >
        <Flex mr={4} alignItems="center">
          <FormLabel htmlFor="rheed-video" mb={{ base: "2", md: "0" }}>
            RHEED
          </FormLabel>
          <Switch
            ref={rheedVideoSwitchRef}
            id="rheed-video"
            colorScheme="green"
            isChecked={rheedNodeState.is_streaming}
            isDisabled={!(rheedNodeState.is_available && rheedNodeState.is_running)}
            onChange={handleRheedVideoSwitch}
            opacity={!isRheedLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
        </Flex>

        <Flex mr={4} alignItems="center">
          <FormLabel htmlFor="rheed-ai" mb={{ base: "2", md: "0" }}>
            Detect
          </FormLabel>
          <Switch
            ref={rheedAISwitchRef}
            id="rheed-ai"
            colorScheme="green"
            isChecked={detectorNodeState.is_streaming}
            isDisabled={!(detectorNodeState.is_available && detectorNodeState.is_running)}
            onChange={handleRheedAISwitch}
            opacity={!isDetectorLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
        </Flex>

        <Flex mr={4} alignItems="center">
          <FormLabel htmlFor="chamber-log" mb={{ base: "2", md: "0" }}>
            Chamber
          </FormLabel>
          <Switch
            ref={chamberLogSwitchRef}
            id="chamber-log"
            colorScheme="green"
            isChecked={chamberNodeState.is_streaming}
            isDisabled={!(chamberNodeState.is_available && chamberNodeState.is_running)}
            onChange={handleChamberLogSwitch}
            opacity={!isChamberLogLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
        </Flex>
      </Flex>
    </Box>
  );
};

export default MainController;
