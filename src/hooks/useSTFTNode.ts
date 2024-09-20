import { useCallback } from 'react';
import useSSE from './useSSE';
import useSTFTNodeStore from '../stores/nodes/stft';

const useSTFTNode = () => {
  const setState = useSTFTNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/RHEED/stft/live/state", onMessage);

  return { isLoading, error };
};

export default useSTFTNode;