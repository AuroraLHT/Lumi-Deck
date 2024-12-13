import { ChamberLogPayload, ChamberLogPayloadHeader } from '../../entities/chamberLog';
import { MiModeExecution } from '../../entities/miMode';

import { create, StateCreator } from "zustand";
import { WebSocketStore } from "../websocket";

import createChamberLogSlice, { ChamberLogStore } from "./chamberLogSlice";
import createMiModeSlice, { MiModeStore } from "./miModeSlice";

import { immer } from "zustand/middleware/immer";
import { parseWebSocketMessage, prepareCommandMessage, prepareControlMessage } from '../../utils/websocket';
import { BaseResponseMessageHeader } from '../../entities/backend';

const chamberLogTarget = "Live Chamber Log";
const miModeTarget = "MI Mode";

interface ChamberClientStore extends WebSocketStore {
    sendChamberLogControlOperation: (
      controlType: string,
      controlPayload?: object
    ) => void;
    sendMIModeControlOperation: (
      controlType: string,
      controlPayload?: object
    ) => void;
    sendChamberLogCommandOperation: (
      commandType: string,
      commandPayload?: object
    ) => void;
    sendMIModeCommandOperation: (
      commandType: string,
      commandPayload?: object
    ) => void;
  }
  
  const createChamberClientSlice: StateCreator<
  ChamberLogStore & MiModeStore & ChamberClientStore,
    [["zustand/immer", never]],
    [],
    ChamberClientStore
  > = (set, get) => ({
    socket: null,
    host: "",
    binaryType: "arraybuffer",
    isConnected: false,
  
    connectWebSocket: (host: string, binaryType: "arraybuffer" | "blob") =>
      set((state) => {
        state.host = host;
        state.binaryType = binaryType;
        const socket = new WebSocket(host);
        socket.binaryType = binaryType;
  
        socket.onopen = () => {
          console.log(`WebSocket ${host} connected`);
  
          get().sendChamberLogCommandOperation("start_streaming");
  
          console.log(`WebSocket ${host} startup message sent`);
          get().setIsConnected(true);
        };
        socket.onclose = () => {
          console.log(`WebSocket ${host} disconnected`);
          get().setIsConnected(false);
        };
        socket.onerror = (error) =>
          console.error(`WebSocket ${host} error:`, error);
  
        const handleMessage = (event: MessageEvent) => {
          const arrayBuffer = event.data;
          let { websocket_header, payload_header, payload_content } =
            parseWebSocketMessage(arrayBuffer);
  
          // console.log("chamber client handle message", websocket_header);
          if (
            websocket_header.target === chamberLogTarget &&
            websocket_header.operation === "stream"
          ) {
            // DEBUG: Bypass this block
            // return;
            const payload = JSON.parse(new TextDecoder().decode(payload_content));
            const chamberLogPayload = payload as ChamberLogPayload;
            const chamberLogHeader = payload_header as ChamberLogPayloadHeader;
            // console.log("chamber client update chamber log from payload", chamberLogPayload, chamberLogHeader);
  
            get().updateChamberLogFromPayload(chamberLogPayload, chamberLogHeader);
          } else if (
            websocket_header.target === miModeTarget &&
            websocket_header.operation === "response"
          ) {
            let message_header = payload_header as BaseResponseMessageHeader;
            if (message_header.response_type === "register_commands") {
              const payload = JSON.parse(new TextDecoder().decode(payload_content));
              const miModePayload = payload as MiModeExecution;
              get().updateRegisterCommandFromPayload(
                miModePayload
              );
            }
          } else if (
            websocket_header.target === miModeTarget &&
            websocket_header.operation === "update"
          ) {
            const payload = JSON.parse(new TextDecoder().decode(payload_content));
            const miModePayload = payload as MiModeExecution;

            get().updateCurrentExecutionFromPayload(
              miModePayload
            );
          } else {
            console.log("chamber client received unknown message", websocket_header);
          } 
        }
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
  
    sendChamberLogControlOperation: (
      controlType: string,
      controlPayload?: object
    ) => {
      const message = prepareControlMessage(
        chamberLogTarget,
        controlType,
        controlPayload
      );
      get().socket?.send(message);
    },
  
    sendMIModeControlOperation: (
      controlType: string,
      controlPayload?: object
    ) => {
      const message = prepareControlMessage(
        miModeTarget,
        controlType,
        controlPayload
      );
      get().socket?.send(message);
    },
  
    sendChamberLogCommandOperation: (
      commandType: string,
      commandPayload?: object
    ) => {
      const message = prepareCommandMessage(
        chamberLogTarget,
        commandType,
        commandPayload
      );
      get().socket?.send(message);
    },
    
    sendMIModeCommandOperation: (
      commandType: string,
      commandPayload?: object
    ) => {
      const message = prepareCommandMessage(
        miModeTarget,
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
  
  const useChamberClient = create<
    ChamberLogStore & MiModeStore & ChamberClientStore
  >()(
    immer((...a) => ({
      ...createChamberClientSlice(...a),
      ...createChamberLogSlice(...a),
      ...createMiModeSlice(...a),
    }))
  );
  
  export default useChamberClient;
  