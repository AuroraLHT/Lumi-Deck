import { create } from 'zustand';
// import useWebSocketStore from "./websocket";
import { WebSocketStore } from './websocket';
import { Log, Logs } from '../entities/chamberLog';
import { immer } from 'zustand/middleware/immer';

interface ChamberLogStore extends WebSocketStore {
    log: Log
    cache: Logs;

    maxCacheSize: number;
    setMaxCacheSize: (maxCacheSize: number) => void;
    updateFromPayload: (payload: Log) => void;
}

const useChamberLogStore = create<ChamberLogStore>()(immer((set, get) => ({
    socket: null,
    host: "",
    binaryType: "blob",
    isConnected: false,
    log: {},
    cache: [],
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

            const handleMessage = (event: MessageEvent) => {
                // console.log(event);
                const payload = JSON.parse(event.data);
                // console.log("before", payload, typeof payload);

                const logPayload = payload as Log
                // console.log("payload", logPayload, typeof logPayload);
                get().updateFromPayload(logPayload);

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

    updateFromPayload: (payload: Log,) => {
        set((state) => {
            state.log = payload;

            state.cache.push(payload);

            // Remove the first element if the cache size exceeds the limit
            if (state.cache.length > state.maxCacheSize) state.cache.shift();

        });
    },
})));

export default useChamberLogStore;