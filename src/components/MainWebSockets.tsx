import React, { useEffect } from 'react';
import useAppStore from '../stores/app';
import useAuthStore, { withAuthToken } from '../stores/auth';
import useLiveAnalysisClient from '../clients/liveAnalysis/analyzer';
// import useChamberLogStore from '../clients/chamber/chamberLog';
import useChamberStore from '../clients/chamber/chamber';
import useRHEEDStore from '../clients/rheed';

interface MainWebsocketsProps {
  children: React.ReactNode;
}

export const WebSocketContext = React.createContext<WebSocket | null>(null);

const MainWebsocketsProvider: React.FC<MainWebsocketsProps> = ({ children }) => {
  const selectedHost = useAppStore((s) => s.selectedHost);
  const token = useAuthStore((s) => s.token);

  const connect_analyzer = useLiveAnalysisClient(s=>s.connectWebSocket);
  const connect_log = useChamberStore(s=>s.connectWebSocket);
  const connect_rheed = useRHEEDStore(s=>s.connectWebSocket);

  // TODO: auto reload if the connect fail in some cases
  useEffect(() => {
    // The browser WebSocket API cannot set an Authorization header, so the token
    // rides in the query string (the API accepts `?token=`). Without a session the
    // server closes the handshake with 1008, so there is no point connecting.
    if (!selectedHost || !token) return;

    connect_rheed(withAuthToken(`ws://${selectedHost}/RHEED/data/live`), "arraybuffer");
    connect_log(withAuthToken(`ws://${selectedHost}/chamber/live`), "arraybuffer");
    connect_analyzer(withAuthToken(`ws://${selectedHost}/RHEED/analysis/live`), "arraybuffer");
    // `token` is a dependency so the sockets reconnect with fresh credentials
    // after a re-login instead of staying closed.
  }, [selectedHost, token]);

  return (
    <WebSocketContext.Provider value={null}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default MainWebsocketsProvider;
