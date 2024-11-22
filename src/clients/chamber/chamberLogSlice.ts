import { StateCreator } from "zustand";
import { ChamberLogPayload, ChamberLogPayloadHeader, Log, Logs } from '../../entities/chamberLog';

export interface ChamberLogStore {
    log: Log
    log_header: ChamberLogPayloadHeader;
    cacheLogs: Logs;
    maxLogCacheSize: number;
    setMaxLogCacheSize: (maxLogCacheSize: number) => void;
    updateChamberLogFromPayload: (payload: ChamberLogPayload, header: ChamberLogPayloadHeader) => void;
}

const createChamberLogSlice: StateCreator<
  ChamberLogStore,
  [["zustand/immer", never]],
  [],
  ChamberLogStore
> = (set) => ({
    log: {},
    log_header: {
        type: "",
        success: false,
    },
    cacheLogs: [],
    maxLogCacheSize: 1000,

    setMaxLogCacheSize: (maxLogCacheSize: number) => {
        set((state) => {
            state.maxLogCacheSize = maxLogCacheSize;
        });
    },

    updateChamberLogFromPayload: (payload: ChamberLogPayload, header: ChamberLogPayloadHeader) => {
        set((state) => {
            state.log = payload as Log;
            state.log_header = header;
            state.cacheLogs.push(payload);

            // Remove the first element if the cache size exceeds the limit
            if (state.cacheLogs.length > state.maxLogCacheSize) state.cacheLogs.shift();

        });
    },
});

export default createChamberLogSlice;