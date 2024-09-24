import { StateCreator } from "zustand";
import { STFTPayload, STFTHeader, STFTCacheBase, STFTCache } from "../../entities/stft";



export interface STFTStore {
  stft: STFTPayload;
  stftTime: string;
  stftTimeStamp: string;

  cacheSTFT: STFTCache;
  maxSTFTCacheSize: number;
  setMaxSTFTCacheSize: (maxCacheSize: number) => void;
  updateSTFTFromPayload: (
    payload: STFTPayload,
    header: STFTHeader
  ) => void;
  updateSTFTCacheFromPayload: (
    payload: STFTCache,
  ) => void;

}

const createSTFTSlice: StateCreator<
  STFTStore,
  [["zustand/immer", never]],
  [],
  STFTStore
> = (set) => ({
  stft: {} as STFTPayload,
  stftTime: "",
  stftTimeStamp: "",
  
  cacheSTFT: {} as STFTCache,
  maxSTFTCacheSize: 20,

  setMaxSTFTCacheSize: (maxCacheSize: number) =>
    set((state) => {
      state.maxSTFTCacheSize = maxCacheSize;
    }),
    
  updateSTFTFromPayload: (payload: STFTPayload, header: STFTHeader) => {
    set((state) => {
      state.stft = payload;
      state.stftTime = payload.time_end;
      state.stftTimeStamp = payload.timestamp_end;

      // cache do not store the mask, other wise it will take too much memory

      Object.entries(payload).forEach(([key, value]) => {
        // console.log("adding to integrator cache", key, value);
        if (key in state.cacheSTFT) {
          state.cacheSTFT[key].push({"content": value, "header": header} as STFTCacheBase);
          if (state.cacheSTFT[key].length > state.maxSTFTCacheSize) {
            state.cacheSTFT[key].shift();
          }
        } else {
          state.cacheSTFT[key] = [{"content": value, "header": header} as STFTCacheBase];
        }
      });

    });
  },

  updateSTFTCacheFromPayload: (payload: STFTCache) => {
    set((state) => {
      state.cacheSTFT = payload;
    });
  },
});

export default createSTFTSlice;
