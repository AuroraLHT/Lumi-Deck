import { useCallback, } from 'react';
import useSSE from './useSSE';
import useChamberLogNodeStore from '../stores/nodes/chamberLog';

const useChamberLogNode = () => {
  const setState = useChamberLogNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/chamber/log/live/state", onMessage);

  return { isLoading, error };
};

export default useChamberLogNode;