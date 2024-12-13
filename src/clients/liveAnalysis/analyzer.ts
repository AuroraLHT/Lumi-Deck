import { create, StateCreator } from "zustand";
import { WebSocketStore } from "../websocket";
import { DetectionPayload, DetectionHeader } from "../../entities/detector";
import {
  IntegrationHeader,
  IntegrationPayload,
  IntegrationCache,
} from "../../entities/integrator";
import { STFTCache, STFTPayload, STFTHeader } from "../../entities/stft";
import {
  parseWebSocketMessage,
  // packWebSocketMessage,
  // encodeObjectToBuffer,
  prepareRequestMessage,
  prepareControlMessage,
  prepareCommandMessage,
} from "../../utils/websocket";

import createDetectionSlice, { DetectionStore } from "./detectionsSlice";
import createIntegratorSlice, { IntegratorStore } from "./integratorSlice";
import createSTFTSlice, { STFTStore } from "./stftSlice";
import { immer } from "zustand/middleware/immer";

// This websocket client would transform into a channel that receive live analysis data
// which include bboxes, classification, region2tracks, intensity oscillation, live fft.
// for now

const liveDetectionTarget = "Live RHEED Detection";
const liveIntegratorTarget = "Live RHEED Integrator";
const liveSTFTTarget = "Live RHEED STFT";
const detectorTarget = "RHEED Detection";
const integratorTarget = "RHEED Integrator";
const stftTarget = "RHEED STFT";

interface LiveAnalysisClientStore extends WebSocketStore {
  sendDetectorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => void;
  sendDetectorCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => void;
  sendDetectorRequest: (requestType: string, requestPayload?: object) => void;
  sendIntegratorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => void;
  sendIntegratorCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => void;
  sendIntegratorRequest: (requestType: string, requestPayload?: object) => void;
  sendSTFTControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => void;
  sendSTFTCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => void;
  sendSTFTRequest: (requestType: string, requestPayload?: object) => void;
}

const createLiveAnalysisClientSlice: StateCreator<
  DetectionStore & IntegratorStore & STFTStore & LiveAnalysisClientStore,
  [["zustand/immer", never]],
  [],
  LiveAnalysisClientStore
> = (set, get) => ({
  socket: null,
  host: "",
  binaryType: "arraybuffer",
  isConnected: false,
  // bboxes: {},
  // classification: {},
  // region2tracks: {},
  // cache: [] as DetectionBase[],
  // cropSetup: null,
  // maxCacheSize: 1000,

  connectWebSocket: (host: string, binaryType: "arraybuffer" | "blob") =>
    set((state) => {
      state.host = host;
      state.binaryType = binaryType;
      const socket = new WebSocket(host);
      socket.binaryType = binaryType;

      socket.onopen = () => {
        console.log(`WebSocket ${host} connected`);

        get().sendDetectorCommandOperation("start_streaming");
        get().sendIntegratorCommandOperation("start_streaming");
        get().sendSTFTCommandOperation("start_streaming");

        console.log("detection startup message sent");
        get().setIsConnected(true);
      };
      socket.onclose = () => {
        console.log(`WebSocket ${host} disconnected`);
        get().setIsConnected(false);
      };
      socket.onerror = (error) =>
        console.error(`WebSocket ${host} error:`, error);

      const handleMessage = (event: MessageEvent) => {
        // console.log("LiveAnalysisClient received: ", event.data)
        const arrayBuffer = event.data;
        const { websocket_header, payload_header, payload_content } =
          parseWebSocketMessage(arrayBuffer);

        // console.log("websocket header", websocket_header);
        if (
          websocket_header.target === liveDetectionTarget &&
          websocket_header.operation === "stream"
        ) {
          // DEBUG: Bypass this block
          // return;
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const detectionPayload = payload as DetectionPayload;
          const detectionHeader = payload_header as DetectionHeader;
          // console.log(payload);
          // console.log(payload_header);

          get().updateDetectionFromPayload(detectionPayload, detectionHeader);
        } else if (
          websocket_header.target === liveIntegratorTarget &&
          websocket_header.operation === "stream"
        ) {
          // console.log("integrator data message received");
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const integrationPayload = payload as IntegrationPayload;
          // console.log(integrationPayload);
          const integrationHeader = payload_header as IntegrationHeader;
          get().updateIntegratorFromPayload(
            integrationPayload,
            integrationHeader
          );
        } else if (
          websocket_header.target === integratorTarget &&
          websocket_header.operation === "Response"
        ) {
          console.log("integrator cache message received response", payload_header);
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const integrationPayload = payload as IntegrationCache;
          get().updateIntegratorCacheFromPayload(integrationPayload);
        } else if (
          websocket_header.target === stftTarget &&
          websocket_header.operation === "Response"
        ) {
          console.log("stft cache message received response", payload_header);
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const stftPayload = payload as STFTCache;
          get().updateSTFTCacheFromPayload(stftPayload);
        } else if (
          websocket_header.target === liveSTFTTarget &&
          websocket_header.operation === "stream"
        ) {
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const stftPayload = payload as STFTPayload;
          const stftHeader = payload_header as STFTHeader;
          get().updateSTFTFromPayload(stftPayload, stftHeader);
        }
      };
      socket.onmessage = handleMessage;

      state.socket = socket;
    }),

  disconnectWebSocket: () =>
    set((state) => {
      state.socket = null;
      state.host = "";
      state.binaryType = "arraybuffer";
      state.isConnected = false;
    }),

  sendDetectorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => {
    const message = prepareControlMessage(
      liveDetectionTarget,
      controlType,
      controlPayload
    );
    get().socket?.send(message);
  },

  sendDetectorCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => {
    const message = prepareCommandMessage(
      liveDetectionTarget,
      commandType,
      commandPayload
    );
    get().socket?.send(message);
  },
  sendDetectorRequest: (requestType: string, requestPayload?: object) => {
    const message = prepareRequestMessage(
      detectorTarget,
      requestType,
      requestPayload
    );
    get().socket?.send(message);
  },

  sendIntegratorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => {
    const message = prepareControlMessage(
      liveIntegratorTarget,
      controlType,
      controlPayload
    );
    get().socket?.send(message);
  },

  sendIntegratorCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => {
    const message = prepareCommandMessage(
      liveIntegratorTarget,
      commandType,
      commandPayload
    );
    get().socket?.send(message);
  },

  sendIntegratorRequest: (requestType: string, requestPayload?: object) => {
    const message = prepareRequestMessage(
      integratorTarget,
      requestType,
      requestPayload
    );
    get().socket?.send(message);
  },

  sendSTFTControlOperation: (controlType: string, controlPayload?: object) => {
    const message = prepareControlMessage(
      liveSTFTTarget,
      controlType,
      controlPayload
    );
    get().socket?.send(message);
  },

  sendSTFTCommandOperation: (commandType: string, commandPayload?: object) => {
    const message = prepareCommandMessage(
      liveSTFTTarget,
      commandType,
      commandPayload
    );
    get().socket?.send(message);
  },

  sendSTFTRequest: (requestType: string, requestPayload?: object) => {
    const message = prepareRequestMessage(stftTarget, requestType, requestPayload);
    get().socket?.send(message);
  },

  setIsConnected: (isConnected: boolean) =>
    set((state) => {
      state.isConnected = isConnected;
    }),
});

const useLiveAnalysisClient = create<
  IntegratorStore & DetectionStore & STFTStore & LiveAnalysisClientStore
>()(
  immer((...a) => ({
    ...createLiveAnalysisClientSlice(...a),
    ...createDetectionSlice(...a),
    ...createIntegratorSlice(...a),
    ...createSTFTSlice(...a),
  }))
);

export default useLiveAnalysisClient;
