import { create } from 'zustand';
// import useWebSocketStore from "./websocket";
import { WebSocketStore } from './websocket';
import { DetectionPayload, DetectionBboxes, DetectionClassification, DetectionRegion2Tracks, DetectionHeader } from '../entities/detector';

interface DetectionBase {
  bboxes: DetectionBboxes;
  classification: DetectionClassification;
  region2tracks: DetectionRegion2Tracks;
  header: DetectionHeader;
}

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
  updateFromPayload: (payload: DetectionPayload, header: DetectionHeader) => void;
}

import { immer } from 'zustand/middleware/immer';

const useDetectionStore = create<DetectionStore>()(immer((set, get) => ({
  socket: null,
  host: "",
  binaryType: "arraybuffer",
  isConnected: false,
  bboxes: {},
  classification: {},
  region2tracks: {},
  cache: [],
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
        socket.send("start_streaming");
        get().setIsConnected(true);
      };
      socket.onclose = () => {
        console.log(`WebSocket ${host} disconnected`);
        get().setIsConnected(false);
      };
      socket.onerror = (error) => console.error(`WebSocket ${host} error:`, error);

      const handleDetectionMessage = (event: MessageEvent) => {
        // console.log(!detectorNodeState.is_streaming, !detectorNodeState.is_running, !detectorNodeState.is_available);
        // if (!detectorNodeState.is_streaming || !detectorNodeState.is_running || !detectorNodeState.is_available) {
        //   console.log("return");
        //   return;
        // }
        // console.log(event);
    
        const arrayBuffer = event.data;
    
        // Read the header length (4 bytes)
        const headerLength = new DataView(arrayBuffer, 0, 4).getUint32(0);
    
        // Read the header JSON
        const headerJson = new TextDecoder().decode(
          arrayBuffer.slice(4, 4 + headerLength)
        );
        let header = JSON.parse(headerJson);
        console.log(header);
    
        const payloadJson = new TextDecoder().decode(
          arrayBuffer.slice(4 + headerLength)
        );
        let payload = JSON.parse(payloadJson);
    
        // console.log("before", payload, typeof payload);
        // console.log("before", header, typeof header);
    
        const detectionPayload = payload as DetectionPayload;
        const detectionHeader = header as DetectionHeader;
    
        // console.log("after", detectionHeader, typeof detectionHeader);
        // console.log("after", detectionPayload, typeof detectionPayload);
    
        get().updateFromPayload(detectionPayload, detectionHeader);
    
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
      state.bboxes = payload.bboxes;
      state.classification = payload.classification;
      state.region2tracks = payload.region2tracks;
      
      state.cache.push({
        bboxes: payload.bboxes,
        classification: payload.classification,
        region2tracks: payload.region2tracks,
        header: header
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
})));

export default useDetectionStore;