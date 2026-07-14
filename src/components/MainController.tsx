import {
  Box,
  Flex,
  FormLabel,
  Switch,
} from "@chakra-ui/react";

import useLiveAnalysisClient from "../clients/liveAnalysis/analyzer";
// import useChamberLogStore from "../clients/chamber/chamberLog";
import useChamberStore from "../clients/chamber/chamber";
import useRHEEDStore from "../clients/rheed";


import { ChangeEvent } from "react";
import { useRef } from "react";

import useRHEEDNodeStore from "../stores/nodes/rheed";
import useRHEEDCameraNodeStore from "../stores/nodes/rheedCamera";
import useChamberLogNodeStore from "../stores/nodes/chamberLog";

// import useMIModeNodeStore from "../stores/nodes/mimode";

import useDetectorNodeStore from "../stores/nodes/detector";
import useSTFTNodeStore from "../stores/nodes/stft";
import useIntegratorNodeStore from "../stores/nodes/integrator";

// the useXNode hooks are used to get the state of the node from the server, it also handles the SSE connection
// might need to refactor the hook form to something like provider pattern to avoid calling the hook in each component
// import useRHEEDNode from "../hooks/useRHEEDNode";
// import useRHEEDCamNode from "../hooks/useRHEEDCamNode";
// import useDetectorNode from "../hooks/useDetectorNode";
// import useChamberLogNode from "../hooks/useChamberLogNode";
// import useSTFTNode from "../hooks/useSTFTNode";
// import useIntegratorNode from "../hooks/useIntegratorNode";
import useNodesState from "../hooks/useNodesState";

const MainController = () => {
  // RHEED
  const { isLoading } = useNodesState();

  // const { isLoading: isRHEEDLoading } = useRHEEDNode();
  // const { isLoading: isRHEEDCameraLoading } = useRHEEDCamNode();

  const rheedNodeState = useRHEEDNodeStore((s) => s.state);
  const setRHEEDNodeStreaming = useRHEEDNodeStore((s) => s.setStreaming);

  const rheedCameraNodeState = useRHEEDCameraNodeStore((s) => s.state);
  const setRHEEDCameraNodeStreaming = useRHEEDCameraNodeStore((s) => s.setStreaming);

  // Chamber Log
  // const { isLoading: isChamberLogLoading } = useChamberLogNode();
  const chamberNodeState = useChamberLogNodeStore((s) => s.state);
  const setChamberNodeStreaming = useChamberLogNodeStore((s) => s.setStreaming);

  // Detector
  // const { isLoading: isDetectorLoading } = useDetectorNode();
  const detectorNodeState = useDetectorNodeStore((s) => s.state);
  const setDetectorNodeStreaming = useDetectorNodeStore((s) => s.setStreaming);

  // STFT
  // const { isLoading: isSTFTLoading } = useSTFTNode();
  const stftNodeState = useSTFTNodeStore((s) => s.state);
  const setSTFTNodeStreaming = useSTFTNodeStore((s) => s.setStreaming);

  // Integrator
  const integratorNodeState = useIntegratorNodeStore((s) => s.state);
  // const { isLoading: isIntegratorLoading } = useIntegratorNode();
  const setIntegratorNodeStreaming = useIntegratorNodeStore(
    (s) => s.setStreaming
  );

  const rheedVideoSwitchRef = useRef<HTMLInputElement>(null);
  const rheedAISwitchRef = useRef<HTMLInputElement>(null);
  const chamberLogSwitchRef = useRef<HTMLInputElement>(null);


  const rheedSocket = useRHEEDStore((s) => s.socket);

  const sendRHEEDControlOperation = useRHEEDStore(
    (s) => s.sendRHEEDControlOperation
  );

  const sendRHEEDCameraControlOperation = useRHEEDStore(
    (s) => s.sendRHEEDCameraControlOperation
  );

  const sendChamberLogControlOperation = useChamberStore(
    (s) => s.sendChamberLogControlOperation
  );

  const sendDetectorControlOperation = useLiveAnalysisClient(
    (s) => s.sendDetectorControlOperation
  );
  // const sendDetectorCommandOperation = useLiveAnalysisClient(
  //   (s) => s.sendDetectorCommandOperation
  // );

  const chamberSocket = useChamberStore((s) => s.socket);
  const sendSTFTControlOperation = useLiveAnalysisClient(
    (s) => s.sendSTFTControlOperation
  );
  // const sendSTFTCommandOperation = useLiveAnalysisClient(s=>s.sendSTFTCommandOperation);

  const analyzerSocket = useLiveAnalysisClient((s) => s.socket);
  const sendIntegratorControlOperation = useLiveAnalysisClient(
    (s) => s.sendIntegratorControlOperation
  );
  // const sendIntegratorCommandOperation = useLiveAnalysisClient(s=>s.sendIntegratorCommandOperation);

  // console.log(sendRHEEDMessage, sendLogMessage, sendDetectionMessage);
  // ... existing code ...

  type SocketOperation = {
    socket: WebSocket | null;
    controlOperation: (control: string) => void;
    setStreaming: (isStreaming: boolean) => void;
  };

  const handleSocketSwitch = (
    event: ChangeEvent<HTMLInputElement>,
    { socket, controlOperation, setStreaming }: SocketOperation
  ) => {
    if (socket?.readyState === WebSocket.OPEN) {
      controlOperation(event.target.checked ? "start_server" : "stop_server");
    }
    setStreaming(event.target.checked);
  };

  // Replace the individual handlers with:
  const handleRHEEDVideoSwitch = (event: ChangeEvent<HTMLInputElement>) =>
    handleSocketSwitch(event, {
      socket: rheedSocket,
      controlOperation: sendRHEEDControlOperation,
      setStreaming: setRHEEDNodeStreaming,
    });

  const handleRHEEDCameraSwitch = (event: ChangeEvent<HTMLInputElement>) =>
    handleSocketSwitch(event, {
      socket: rheedSocket,
      controlOperation: sendRHEEDCameraControlOperation,
      setStreaming: setRHEEDCameraNodeStreaming,
    });

  const handleRHEEDAISwitch = (event: ChangeEvent<HTMLInputElement>) =>
    handleSocketSwitch(event, {
      socket: analyzerSocket,
      controlOperation: sendDetectorControlOperation,
      setStreaming: setDetectorNodeStreaming,
    });

  const handleChamberLogSwitch = (event: ChangeEvent<HTMLInputElement>) =>
    handleSocketSwitch(event, {
      socket: chamberSocket,
      controlOperation: sendChamberLogControlOperation,
      setStreaming: setChamberNodeStreaming,
    });

  const handleSTFTSwitch = (event: ChangeEvent<HTMLInputElement>) =>
    handleSocketSwitch(event, {
      socket: analyzerSocket,
      controlOperation: sendSTFTControlOperation,
      setStreaming: setSTFTNodeStreaming,
    });

  const handleIntegratorSwitch = (event: ChangeEvent<HTMLInputElement>) =>
    handleSocketSwitch(event, {
      socket: analyzerSocket,
      controlOperation: sendIntegratorControlOperation,
      setStreaming: setIntegratorNodeStreaming,
    });

  return (
    // No heading here any more: the panel chrome already titles this "Controller",
    // so an in-body <h1> just repeated it.
    <Box p={2}>
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
            isDisabled={
              !(rheedNodeState.is_available && rheedNodeState.is_running)
            }
            onChange={handleRHEEDVideoSwitch}
            opacity={!isLoading ? 1 : 0.5}
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
            isDisabled={
              !(detectorNodeState.is_available && detectorNodeState.is_running)
            }
            onChange={handleRHEEDAISwitch}
            opacity={!isLoading ? 1 : 0.5}
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
            isDisabled={
              !(chamberNodeState.is_available && chamberNodeState.is_running)
            }
            onChange={handleChamberLogSwitch}
            opacity={!isLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
        </Flex>

        <Flex mr={4} alignItems="center">
          <FormLabel htmlFor="integrator" mb={{ base: "2", md: "0" }}>
            Integrator
          </FormLabel>
          <Switch
            id="integrator"
            colorScheme="green"
            isChecked={integratorNodeState.is_streaming}
            isDisabled={
              !(
                integratorNodeState.is_available &&
                integratorNodeState.is_running
              )
            }
            onChange={handleIntegratorSwitch}
            opacity={!isLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
        </Flex>

        <Flex mr={4} alignItems="center">
          <FormLabel htmlFor="stft" mb={{ base: "2", md: "0" }}>
            STFT
          </FormLabel>
          <Switch
            id="stft"
            colorScheme="green"
            isChecked={stftNodeState.is_streaming}
            isDisabled={
              !(stftNodeState.is_available && stftNodeState.is_running)
            }
            onChange={handleSTFTSwitch}
            opacity={!isLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
        </Flex>
      </Flex>

      <Flex mr={4} alignItems="center">
          <FormLabel htmlFor="rheed-cam" mb={{ base: "2", md: "0" }}>
            RHEED Cam
          </FormLabel>
          <Switch
            id="rheed-cam"
            colorScheme="green"
            isChecked={rheedCameraNodeState.is_streaming}
            isDisabled={
              !(rheedCameraNodeState.is_available && rheedCameraNodeState.is_running)
            }
            onChange={handleRHEEDCameraSwitch}
            opacity={!isLoading ? 1 : 0.5}
            transition="opacity 0.2s"
          />
      </Flex>


      {/* <Flex
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
          <Button
            onClick={() => sendDetectorCommandOperation("start_streaming")}
            isDisabled={
              !(detectorNodeState.is_available && detectorNodeState.is_running)
            }
            opacity={!detectorNodeState.is_streaming ? 1 : 0.5}
            transition="opacity 0.2s"
          >
            Start Detection Streaming
          </Button>
        </Flex>
        <Flex mr={4} alignItems="center">
          <Button
            onClick={() => sendDetectorCommandOperation("end_streaming")}
            isDisabled={
              !(detectorNodeState.is_available && detectorNodeState.is_running)
            }
            opacity={!detectorNodeState.is_streaming ? 1 : 0.5}
            transition="opacity 0.2s"
          >
            End Detection Streaming
          </Button>
        </Flex>
      </Flex> */}
    </Box>
  );
};

export default MainController;
