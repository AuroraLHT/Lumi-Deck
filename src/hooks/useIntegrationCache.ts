import useIntegratorStore from "../stores/integrator";

/**
 * Reads the integrator cache. The samples are put there by `useAnalysisStreams`,
 * which owns the single `rheed.integrator` subscription over the shared transport.
 */
const useIntegrationCache = () => {
  const cache = useIntegratorStore((s) => s.cache);
  return { cache };
};

export default useIntegrationCache;
