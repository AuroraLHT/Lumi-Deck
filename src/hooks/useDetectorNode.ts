import { useCallback, } from 'react';
import useSSE from './useSSE';
import useDetectorNodeStore from '../stores/nodes/detector';

const useDetectorNode = () => {
  const setState = useDetectorNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    console.log("detector node data", data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/RHEED/detection/live/state", onMessage);

  return { isLoading, error };
};

export default useDetectorNode;