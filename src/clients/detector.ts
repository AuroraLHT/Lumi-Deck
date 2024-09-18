import { create } from "zustand";
// import useWebSocketStore from "./websocket";
import { WebSocketStore } from "./websocket";
import {
  DetectionPayload,
  DetectionBboxes,
  DetectionClassification,
  DetectionRegion2Tracks,
  DetectionHeader,
  DetectionBase,
} from "../entities/detector";
import {
  parseWebSocketMessage,
  packWebSocketMessage,
} from "../utils/websocket";

//TODO: this websocket client would transform into a channel that receive live analysis data
// which include bboxes, classification, region2tracks, intensity oscillation, live fft.
// for now

interface DetectionStore extends WebSocketStore {
  bboxes: DetectionBboxes;
  classification: DetectionClassification;
  region2tracks: DetectionRegion2Tracks;

  cache: DetectionBase[];

  isConnected: boolean;
  cropSetup: {
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  } | null;

  maxCacheSize: number;
  setIsConnected: (isConnected: boolean) => void;
  setMaxCacheSize: (maxCacheSize: number) => void;
  updateFromPayload: (
    payload: DetectionPayload,
    header: DetectionHeader
  ) => void;
  sendControlOperation: (controlType: string, controlPayload?: ArrayBuffer) => void;
}

import { immer } from "zustand/middleware/immer";

const useDetectionStore = create<DetectionStore>()(
  immer((set, get) => ({
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

          get().sendControlOperation("start_streaming");

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
          // console.log(!detectorNodeState.is_streaming, !detectorNodeState.is_running, !detectorNodeState.is_available);
          // if (!detectorNodeState.is_streaming || !detectorNodeState.is_running || !detectorNodeState.is_available) {
          //   console.log("return");
          //   return;
          // }
          // console.log(event);

          const arrayBuffer = event.data;
          const { websocket_header, payload_header, payload_content } =
            parseWebSocketMessage(arrayBuffer);

          // // Read the header length (4 bytes)
          // const headerLength = new DataView(arrayBuffer, 0, 4).getUint32(0);

          // // Read the header JSON
          // const headerJson = new TextDecoder().decode(
          //   arrayBuffer.slice(4, 4 + headerLength)
          // );
          // let header = JSON.parse(headerJson);
          // // console.log(header);

          // const payloadJson = new TextDecoder().decode(
          //   arrayBuffer.slice(4 + headerLength)
          // );
          // let payload = JSON.parse(payloadJson);

          // console.log("before", payload, typeof payload);
          // console.log("before", header, typeof header);

          // const detectionPayload = payload as DetectionPayload;
          // const detectionHeader = header as DetectionHeader;

          if (
            websocket_header.target === "Live Detection" &&
            websocket_header.operation === "data"
          ) {
            const payload = JSON.parse(
              new TextDecoder().decode(payload_content)
            );
            const detectionPayload = payload as DetectionPayload;
            const detectionHeader = payload_header as DetectionHeader;
            console.log(detectionPayload);
            get().updateFromPayload(detectionPayload, detectionHeader);
          }
          // console.log("after", detectionHeader, typeof detectionHeader);
          // console.log("after", detectionPayload, typeof detectionPayload);
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

    sendControlOperation: (controlType: string, controlPayload?: ArrayBuffer) => {
      const message = packWebSocketMessage(
        {
          target: "Live Detection",
          operation: "control",
          payload_type: "bytes",
        },
        { type: controlType, },
        controlPayload || new ArrayBuffer(0)
      );
      get().socket?.send(message);
    },

    setIsConnected: (isConnected: boolean) =>
      set((state) => {
        state.isConnected = isConnected;
      }),
    setMaxCacheSize: (maxCacheSize: number) =>
      set((state) => {
        state.maxCacheSize = maxCacheSize;
      }),
    updateFromPayload: (payload: DetectionPayload, header: DetectionHeader) => {
      set((state) => {
        state.bboxes = payload.bboxes as DetectionBboxes;
        state.classification =
          payload.classification as DetectionClassification;
        state.region2tracks = payload.region2tracks as DetectionRegion2Tracks;

        // cache do not store the mask, other wise it will take too much memory
        const cache_bboxes = Object.fromEntries(
          Object.entries(payload.bboxes).map(([key, value]) => [
            key,
            {
              bbox: value.bbox,
              label: value.label,
              score: value.score,
            },
          ])
        );

        state.cache.push({
          bboxes: cache_bboxes,
          classification: payload.classification as DetectionClassification,
          region2tracks: payload.region2tracks as DetectionRegion2Tracks,
          header: header as DetectionHeader,
        });

        // Remove the first element if the cache size exceeds the limit
        if (state.cache.length > state.maxCacheSize) state.cache.shift();

        state.cropSetup = {
          sx: header.crop_setup_sx,
          sy: header.crop_setup_sy,
          ex: header.crop_setup_ex,
          ey: header.crop_setup_ey,
        };
      });
    },
  }))
);

export default useDetectionStore;
