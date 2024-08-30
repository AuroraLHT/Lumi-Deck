import { useEffect, useState } from 'react';
import useAppStore from '../stores/app';

const useSSE = (endpoint: string, onMessage: (event: MessageEvent) => void) => {
  const host = useAppStore((s) => s.selectedHost);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // skip if no host
    if (!host) {
      return;
    }

    const url = `http://${host}${endpoint}`;
    console.log("SSE URL:", url);
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log("SSE connection opened:", url);
      setIsLoading(false);
    };

    eventSource.onmessage = onMessage;

    eventSource.onerror = (err) => {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      setIsLoading(true);
    };

    return () => {
      setIsLoading(true);
      eventSource.close();
    };
  }, [host, endpoint]);

  useEffect(() => {
    if (error) {
      console.error('SSE connection error:', error);
    }
  }, [error]);

  return { isLoading, error };
};

export default useSSE;