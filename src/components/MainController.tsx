import { Box, Flex, FormLabel, Heading, Switch } from "@chakra-ui/react";

import useDetectorStore from "../clients/detector";
import useChamberLogStore from "../clients/chamberLog";
import useRHEEDStore from "../clients/rheed";

import { ChangeEvent } from "react";
import { useRef } from "react";
import useRheedNodeStore from "../stores/nodes/rheed";
import useChamberLogNodeStore from "../stores/nodes/chamberLog";
import useDetectorNodeStore from "../stores/nodes/detector";

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


  const rheedSocket = useRHEEDStore(s=>s.socket);
  const logSocket = useChamberLogStore(s=>s.socket);
  const detectionSocket = useDetectorStore(s=>s.socket);
  const detectionSendControlOperation = useDetectorStore(s=>s.sendControlOperation);

  // console.log(sendRheedMessage, sendLogMessage, sendDetectionMessage);
  const handleRheedVideoSwitch = (event: ChangeEvent<HTMLInputElement>) => {
    if (rheedSocket && rheedSocket.readyState == WebSocket.OPEN){
      rheedSocket.send(event.target.checked ? "start_server" : "stop_server")
    }

    setRHEEDNodeStreaming(event.target.checked);
  };

  const handleRheedAISwitch = (event: ChangeEvent<HTMLInputElement>) => {
    if (detectionSocket && detectionSocket.readyState == WebSocket.OPEN){
      detectionSendControlOperation(event.target.checked ? "start_server" : "stop_server")      
      // const message = packWebSocketMessage(
      //   {
      //     target: "Live Detection",
      //     operation: "control",
      //     payload_type: "bytes",
      //   },
      //   { type: event.target.checked ? "start_server" : "stop_server" },
      //   new ArrayBuffer(0)
      // );

      // detectionSocket.send(message)
    }

    setDetectorNodeStreaming(event.target.checked);
  };

  const handleChamberLogSwitch = (event: ChangeEvent<HTMLInputElement>) => {
    if (logSocket && logSocket.readyState == WebSocket.OPEN){
      logSocket.send(event.target.checked ? "start_server" : "stop_server")
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
