import useDetectionStore from "../stores/detection";

/**
 * Reads the detection history the classification chart plots. Filled by
 * `useDetectionStream`, which owns the single `detection.overlay` subscription.
 */
const useDetectionCache = () => {
  const cache = useDetectionStore((s) => s.cache);
  return { cache };
};

export default useDetectionCache;
