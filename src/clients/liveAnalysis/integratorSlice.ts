import { StateCreator } from "zustand";
import { IntegrationPayload, IntegrationHeader, IntegrationCacheBase, IntegrationCache } from "../../entities/integrator";


export interface IntegratorStore {
  integration: IntegrationPayload;
  integrationTime: string;
  integrationTimeStamp: string;
  integrationFrameUUID: string;

  cacheIntegrator: IntegrationCache;
  maxIntegratorCacheSize: number;
  setMaxIntegratorCacheSize: (maxCacheSize: number) => void;
  updateIntegratorFromPayload: (
    payload: IntegrationPayload,
    header: IntegrationHeader
  ) => void;
  updateIntegratorCacheFromPayload: (
    payload: IntegrationCache,
  ) => void;

}

const createIntegratorSlice: StateCreator<
  IntegratorStore,
  [["zustand/immer", never]],
  [],
  IntegratorStore
> = (set) => ({
  integration: {} as IntegrationPayload,
  integrationTime: "",
  integrationTimeStamp: "",
  integrationFrameUUID: "",
  
  cacheIntegrator: {} as IntegrationCache,
  maxIntegratorCacheSize: 200,

  setMaxIntegratorCacheSize: (maxCacheSize: number) =>
    set((state) => {
      state.maxIntegratorCacheSize = maxCacheSize;
    }),
    
  updateIntegratorFromPayload: (payload: IntegrationPayload, header: IntegrationHeader) => {
    set((state) => {
      state.integration = payload;
      state.integrationTime = header.time;
      state.integrationTimeStamp = header.time_stamp;
      state.integrationFrameUUID = header.uuid;

      // cache do not store the mask, other wise it will take too much memory

      Object.entries(payload).forEach(([key, value]) => {
        if (key in state.cacheIntegrator) {
          state.cacheIntegrator[key].push({"content": value, "header": header} as IntegrationCacheBase);
          if (state.cacheIntegrator[key].length > state.maxIntegratorCacheSize) {
            state.cacheIntegrator[key].shift();
          }
        } else {
          state.cacheIntegrator[key] = [{"content": value, "header": header} as IntegrationCacheBase];
        }
      });

    });
  },

  updateIntegratorCacheFromPayload: (payload: IntegrationCache) => {
    set((state) => {
      state.cacheIntegrator = payload;
    });
  },
});

export default createIntegratorSlice;
