import useSTFTStore from "../stores/stft";

/**
 * Reads the STFT cache. The windows are put there by `useAnalysisStreams`, which
 * owns the single `rheed.stft` subscription over the shared transport.
 */
const useSTFTCache = () => {
  const cache = useSTFTStore((s) => s.cache);
  return { cache };
};

export default useSTFTCache;
