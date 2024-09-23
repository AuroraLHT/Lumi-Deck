import { create, StateCreator } from "zustand";
import { WebSocketStore } from "../websocket";
import {
  DetectionPayload,
  DetectionHeader,
  DetectionBase,
} from "../../entities/detector";
import {
  IntegrationHeader,
  IntegrationPayload,
  IntegrationCache,
} from "../../entities/integrator";

import {
  parseWebSocketMessage,
  packWebSocketMessage,
  encodeObjectToBuffer,
} from "../../utils/websocket";

import createDetectionSlice, { DetectionStore } from "./detectionsSlice";
import createIntegratorSlice, { IntegratorStore } from "./integratorSlice";
import { immer } from "zustand/middleware/immer";

//TODO: this websocket client would transform into a channel that receive live analysis data
// which include bboxes, classification, region2tracks, intensity oscillation, live fft.
// for now


const prepareControlMessage = (
  target: string,
  controlType: string,
  controlPayload?: object
) => {
  return packWebSocketMessage(
    {
      target: target,
      operation: "control",
      payload_type: "bytes",
    },
    { type: controlType },
    controlPayload ? encodeObjectToBuffer(controlPayload) : new ArrayBuffer(0)
  );
};

const prepareCommandMessage = (
  target: string,
  commandType: string,
  commandPayload?: object
) => {
  return packWebSocketMessage(
    {
      target: target,
      operation: "command",
      payload_type: "json",
    },
    { type: commandType },
    commandPayload ? encodeObjectToBuffer(commandPayload) : new ArrayBuffer(0)
  );
};


interface LiveAnalysisClientStore extends WebSocketStore {
  sendDetectorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => void;
  sendIntegratorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => void;
  sendSTFTControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => void;
  sendIntegratorCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => void;
  sendSTFTCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => void;
}

const createWebSocketSlice: StateCreator<
  DetectionStore & IntegratorStore & LiveAnalysisClientStore,
  [["zustand/immer", never]],
  [],
  LiveAnalysisClientStore
> = (set, get) => ({
  socket: null,
  host: "",
  binaryType: "arraybuffer",
  isConnected: false,
  bboxes: {},
  classification: {},
  region2tracks: {},
  cache: [] as DetectionBase[],
  cropSetup: null,
  maxCacheSize: 1000,

  connectWebSocket: (host: string, binaryType: "arraybuffer" | "blob") =>
    set((state) => {
      state.host = host;
      state.binaryType = binaryType;
      const socket = new WebSocket(host);
      socket.binaryType = binaryType;

      socket.onopen = () => {
        console.log(`WebSocket ${host} connected`);

        get().sendDetectorControlOperation("start_streaming");
        get().sendIntegratorControlOperation("start_streaming");
        get().sendSTFTControlOperation("start_streaming");

        console.log("detection startup message sent");
        get().setIsConnected(true);
      };
      socket.onclose = () => {
        console.log(`WebSocket ${host} disconnected`);
        get().setIsConnected(false);
      };
      socket.onerror = (error) =>
        console.error(`WebSocket ${host} error:`, error);

      const handleDetectionMessage = (event: MessageEvent) => {
        const arrayBuffer = event.data;
        const { websocket_header, payload_header, payload_content } =
          parseWebSocketMessage(arrayBuffer);

        if (
          websocket_header.target === "Live Detection" &&
          websocket_header.operation === "data"
        ) {
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const detectionPayload = payload as DetectionPayload;
          const detectionHeader = payload_header as DetectionHeader;
          // console.log(detectionPayload);

          get().updateDetectionFromPayload(detectionPayload, detectionHeader);
        } else if (
          websocket_header.target === "Live Integrator" &&
          websocket_header.operation === "data"
        ) {
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const integrationPayload = payload as IntegrationPayload;
          const integrationHeader = payload_header as IntegrationHeader;
          get().updateIntegratorFromPayload(
            integrationPayload,
            integrationHeader
          );
        } else if (
          websocket_header.target === "Integrator" &&
          websocket_header.operation === "cache"
        ) {
          const payload = JSON.parse(new TextDecoder().decode(payload_content));
          const integrationPayload = payload as IntegrationCache;
          get().updateIntegratorCacheFromPayload(
            integrationPayload
          );
        }
      };
      socket.onmessage = handleDetectionMessage;

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
      "Live Detection",
      controlType,
      controlPayload
    );
    get().socket?.send(message);
  },

  sendIntegratorControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => {
    const message = prepareControlMessage(
      "Live Integrator",
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
      "Integrator",
      commandType,
      commandPayload
    );
    get().socket?.send(message);
  },
  
  sendSTFTControlOperation: (
    controlType: string,
    controlPayload?: object
  ) => {
    const message = prepareControlMessage(
      "Live STFT",
      controlType,
      controlPayload
    );
    get().socket?.send(message);
  },

  sendSTFTCommandOperation: (
    commandType: string,
    commandPayload?: object
  ) => {
    const message = prepareCommandMessage(
      "STFT",
      commandType,
      commandPayload
    );
    get().socket?.send(message);
  },

  setIsConnected: (isConnected: boolean) =>
    set((state) => {
      state.isConnected = isConnected;
    }),
});

const useLiveAnalysisClient = create<
  IntegratorStore & DetectionStore & LiveAnalysisClientStore
>()(
  immer((...a) => ({
    ...createWebSocketSlice(...a),
    ...createDetectionSlice(...a),
    ...createIntegratorSlice(...a),
  }))
);

export default useLiveAnalysisClient;
