import { create } from 'zustand';
// import useWebSocketStore from "./websocket";
import { WebSocketStore } from './websocket';
import { immer } from 'zustand/middleware/immer';

interface RHEEDHeader {
    frag_idx: number;
    frame_end: string;
    frame_start: string;
    index?: number;
    size?: number;
}

type RHEEDFragmentBase = {
    header: RHEEDHeader;
    payload: ArrayBuffer;
}

interface RHEEDStore extends WebSocketStore {
    fragment: ArrayBuffer;
    initialFragments: RHEEDFragmentBase[];
    initialFragmentsLastId: number;
    cache: RHEEDFragmentBase[];
    readedCacheIndex: number;

    maxCacheSize: number;
    setMaxCacheSize: (maxCacheSize: number) => void;
    updateFromPayload: (payload: ArrayBuffer, header:RHEEDHeader) => void;
    clearCache: () => void;
    getUnreadedCache: () => RHEEDFragmentBase[];
    getFrag: () => RHEEDFragmentBase | null;
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
                console.log(`WebSocket ${host} send start_streaming`);                
                get().setIsConnected(true);
            };
            socket.onclose = () => {
                console.log(`WebSocket ${host} disconnected`);
                get().setIsConnected(false);
            };
            socket.onerror = (error) => console.error(`WebSocket ${host} error:`, error);

            const handleMessage = (event: MessageEvent) => {
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

                const payload = arrayBuffer.slice(4 + headerLength);
                get().updateFromPayload(payload, header);

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

    setIsConnected: (isConnected: boolean) =>
        set((state) => {
            state.isConnected = isConnected;
        }),
    setMaxCacheSize: (maxCacheSize: number) =>
        set((state) => {
            state.maxCacheSize = maxCacheSize;
        }),

    updateFromPayload: (payload: ArrayBuffer, header:RHEEDHeader) => {
        set((state) => {
            state.fragment = payload;
            if (header.size) {
                state.initialFragments.push({header, payload});
                state.initialFragmentsLastId = Math.max(state.initialFragmentsLastId, header.frag_idx);
            } else {
                state.cache.push({header, payload});
            }

            console.log(header);
            // Remove the first element if the cache size exceeds the limit
            if (state.cache.length > state.maxCacheSize){
                state.cache.shift();
                if(state.readedCacheIndex > 0) state.readedCacheIndex -= 1;
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
    }

})));

export default useRHEEDStore;