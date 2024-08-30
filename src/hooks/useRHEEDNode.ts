import { useCallback } from 'react';
import useSSE from './useSSE';
import useRheedNodeStore from '../stores/nodes/rheed';

const useRHEEDNode = () => {
  const setState = useRheedNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/RHEED/cam/live/state", onMessage);

  return { isLoading, error };
};

export default useRHEEDNode;