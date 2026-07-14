import { useEffect, useState } from 'react';
import useAppStore from '../stores/app';
import useAuthStore, { withAuthToken } from '../stores/auth';

const useSSE = (endpoint: string, onMessage: (event: MessageEvent) => void) => {
  const host = useAppStore((s) => s.selectedHost);
  const token = useAuthStore((s) => s.token);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Wait for a host *and* a session: EventSource cannot send an Authorization
    // header, so connecting without a token would just 401.
    if (!host || !token) {
      return;
    }

    const url = withAuthToken(`http://${host}${endpoint}`);
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsLoading(false);
    };

    eventSource.onmessage = onMessage;

    eventSource.onerror = (err) => {
      setError(err instanceof Error ? err : new Error('SSE connection failed'));
      setIsLoading(true);
    };

    return () => {
      setIsLoading(true);
      eventSource.close();
    };
    // `token` is a dependency so the stream reconnects with fresh credentials
    // after a re-login instead of staying dead.
  }, [host, endpoint, token]);

  useEffect(() => {
    if (error) {
      console.error('SSE connection error:', error);
    }
  }, [error]);

  return { isLoading, error };
};

export default useSSE;
