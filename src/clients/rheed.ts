import { create } from 'zustand';
import { WebSocketStore } from './websocket';
import { parseWebSocketMessage, prepareCommandMessage, prepareControlMessage, prepareRequestMessage } from '../utils/websocket';
import { immer } from 'zustand/middleware/immer';
import { RHEEDHeader, RHEEDFragmentBase } from '../entities/rheed';

const liveRheedVideoTarget = "Live RHEED Video";
const rheedVideoTarget = "RHEED Video";
const liveRheedCameraTarget = "Live RHEED Camera";

interface RHEEDStore extends WebSocketStore {
    fragment: ArrayBuffer;
    initialFragments: RHEEDFragmentBase[];
    initialFragmentsLastId: number;
    cache: RHEEDFragmentBase[];
    readedCacheIndex: number;

    maxCacheSize: number;
    setMaxCacheSize: (maxCacheSize: number) => void;
    updateCacheFromPayload: (payload: ArrayBuffer, header:RHEEDHeader) => void;
    updateInitialFragments: (payload: ArrayBuffer, header: { [key: string]: RHEEDHeader }) => void;
    clearCache: () => void;
    getUnreadedCache: () => RHEEDFragmentBase[];
    getFrag: () => RHEEDFragmentBase | null;
    requestInitialFragments: () => void;
    sendRHEEDRequestOperation: (
        requestType: string,
        requestPayload?: object
      ) => void;
    sendRHEEDControlOperation: (
        controlType: string,
        controlPayload?: object
      ) => void;
    sendRHEEDCommandOperation: (
        commandType: string,
        commandPayload?: object
      ) => void;
    sendRHEEDCameraControlOperation: (
        cameraType: string,
        cameraPayload?: object
      ) => void;
    sendRHEEDCameraCommandOperation: (
        cameraType: string,
        cameraPayload?: object
      ) => void;
}

const useRHEEDStore = create<RHEEDStore>()(immer((set, get) => ({
    socket: null,
    host: "",
    binaryType: "arraybuffer",
    isConnected: false,
    fragment: new ArrayBuffer(0),
    initialFragments: [],
    cache: [],
    readedCacheIndex :0,
    initialFragmentsLastId: 0,
    maxCacheSize: 100,

    connectWebSocket: (host: string, binaryType: "arraybuffer" | "blob") =>
        set((state) => {
            state.host = host;
            state.binaryType = binaryType;
            const socket = new WebSocket(host);
            socket.binaryType = binaryType;

            const handleMessage = (event: MessageEvent) => {
                // Since the RHEED stream only has one type of message, we can directly parse the message here
                // console.log("RHEEDClient received: ", event.data)
                const arrayBuffer = event.data;
                const { websocket_header, payload_header, payload_content } =
                  parseWebSocketMessage(arrayBuffer);
        
                // console.log("websocket header", websocket_header);
                if (
                  websocket_header.target === liveRheedVideoTarget &&
                  websocket_header.operation === "stream"
                ) {
                    // console.log("RHEEDClient received stream message", payload_header);
                    // console.log("RHEEDClient received stream message");
                    get().updateCacheFromPayload(payload_content, payload_header);
                } else if (
                    websocket_header.target === rheedVideoTarget &&
                    websocket_header.operation === "response"
                ) {
                    // console.log("RHEEDClient received initial fragments response", payload_header);
                    get().updateInitialFragments(payload_content, payload_header);
                } else {
                    console.log("RHEEDClient received unknown message", websocket_header);
                }
                

            };
            socket.onmessage = handleMessage;

            socket.onopen = () => {
                console.log(`WebSocket ${host} connected`);
                // socket.send("start_streaming");
                get().requestInitialFragments();
                get().sendRHEEDCommandOperation("start_streaming");
                // console.log(`WebSocket ${host} send start_streaming`);                
                get().setIsConnected(true);
            };
            socket.onclose = () => {
                console.log(`WebSocket ${host} disconnected`);
                get().setIsConnected(false);
            };
            socket.onerror = (error) => console.error(`WebSocket ${host} error:`, error);

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

    updateCacheFromPayload: (payload: ArrayBuffer, header:RHEEDHeader) => {
        set((state) => {
            // state.fragment = payload;
            // if (header.size) {
            //     state.initialFragments.push({header, payload});
            //     state.initialFragmentsLastId = Math.max(state.initialFragmentsLastId, header.frag_idx);
            // } else {
            //     state.cache.push({header, payload});
            // }
            state.cache.push({header, payload});

            // console.log(header);
            // Remove the first element if the cache size exceeds the limit
            if (state.cache.length > state.maxCacheSize){
                state.cache.shift();
                if(state.readedCacheIndex > 0) state.readedCacheIndex -= 1;
            }

        });
    },

    updateInitialFragments: (payload: ArrayBuffer, header: { [key: string]: RHEEDHeader }) => {
        const fragments: RHEEDFragmentBase[] = [];
        
        // Parse the payload content which contains base64 fragments and headers
        const content = JSON.parse(new TextDecoder().decode(payload));
        // console.log("RHEEDClient received initial fragments content", content);

        // Get sorted keys
        const sortedKeys = Object.keys(content).sort((a, b) => Number(a) - Number(b));
        // Iterate through all fragments in the content

        sortedKeys.forEach(idx => {
            console.log("RHEEDClient received initial fragment", idx);
            // Decode base64 string to ArrayBuffer
            const base64String = content[idx];

            const binaryString = atob(base64String);
            const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));

            fragments.push({
                header: header[idx],
                payload: bytes.buffer
            });
        });
        
        set((state) => {
            state.initialFragments = fragments;
            // Update lastId if needed
            if (fragments.length > 0) {
                state.initialFragmentsLastId = Math.max(
                    ...fragments.map(f => f.header.frag_idx)
                );
            }
        });
    },

    
    clearCache: () => {
        set((state) => {
            state.cache = [];
            state.fragment = new ArrayBuffer(0);
        });
    },
    
    getUnreadedCache: () => {
        const unReaded = get().cache.slice(get().readedCacheIndex);
        set((state) => { state.readedCacheIndex = get().cache.length;});
        return unReaded;
    },

    getFrag: () => {
        if (get().cache.length === 0) return null;
        const frag = get().cache[0];
        set((state) => { state.cache.shift(); });
        return frag;
    },

    requestInitialFragments: () => {
        get().sendRHEEDRequestOperation("initial_fragments");
    },

    sendRHEEDRequestOperation: (
        requestType: string,
        requestPayload?: object
      ) => {
        const message = prepareRequestMessage(
            rheedVideoTarget,
            requestType,
            requestPayload
          );
          get().socket?.send(message);
        //   logWebSocketMessage(message);
  
      },

    sendRHEEDControlOperation: (
        controlType: string,
        controlPayload?: object
      ) => {
        const message = prepareControlMessage(
          liveRheedVideoTarget,
          controlType,
          controlPayload
        );
        get().socket?.send(message);
        //   logWebSocketMessage(message);
      },

    sendRHEEDCommandOperation: (
        commandType: string,
        commandPayload?: object
      ) => {
        const message = prepareCommandMessage(
          liveRheedVideoTarget,
          commandType,
          commandPayload
        );
        get().socket?.send(message);
        // logWebSocketMessage(message);
      },

    sendRHEEDCameraCommandOperation: (
        cameraType: string,
        cameraPayload?: object
      ) => {
        const message = prepareCommandMessage(
          liveRheedCameraTarget,
          cameraType,
          cameraPayload
        );
        get().socket?.send(message);
      },

      sendRHEEDCameraControlOperation: (
        cameraType: string,
        cameraPayload?: object
      ) => {
        const message = prepareControlMessage(
          liveRheedCameraTarget,
          cameraType,
          cameraPayload
        );
        get().socket?.send(message);
      },
})));

export default useRHEEDStore;
