import { useCallback } from 'react';
import useSSE from './useSSE';
import useIntegratorNodeStore from '../stores/nodes/integrator';

const useIntegratorNode = () => {
  const setState = useIntegratorNodeStore((s) => s.setState);

  const onMessage = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    setState(data);
  }, []);

  const { isLoading, error } = useSSE("/RHEED/integrator/live/state", onMessage);

  return { isLoading, error };
};

export default useIntegratorNode;