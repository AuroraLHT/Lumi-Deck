import { useCallback } from 'react';
import useSSE from './useSSE';
import useRheedCamNodeStore from '../stores/nodes/rheedCamera';

const useRHEEDCamNode = () => {
  const setState = useRheedCamNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/RHEED/camera/live/state", onMessage);

  return { isLoading, error };
};

export default useRHEEDCamNode;