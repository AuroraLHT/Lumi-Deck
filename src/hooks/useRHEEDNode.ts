import { useCallback } from 'react';
import useSSE from './useSSE';
import useRHEEDNodeStore from '../stores/nodes/rheed';

const useRHEEDNode = () => {
  const setState = useRHEEDNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/RHEED/video/live/state", onMessage);

  return { isLoading, error };
};

export default useRHEEDNode;