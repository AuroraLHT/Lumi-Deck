import React, { useEffect } from 'react';
import useAppStore from '../stores/app';
import useLiveAnalysisClient from '../clients/liveAnalysis/analyzer';
// import useChamberLogStore from '../clients/chamber/chamberLog';
import useChamberStore from '../clients/chamber/chamber';
import useRHEEDStore from '../clients/rheed';

interface MainWebsocketsProps {
  children: React.ReactNode;
}

export const WebSocketContext = React.createContext<WebSocket | null>(null);

const MainWebsocketsProvider: React.FC<MainWebsocketsProps> = ({ children }) => {
  const { selectedHost } = useAppStore();
  const connect_analyzer = useLiveAnalysisClient(s=>s.connectWebSocket);
  const connect_log = useChamberStore(s=>s.connectWebSocket);  
  const connect_rheed = useRHEEDStore(s=>s.connectWebSocket);

  // TODO: auto reload if the connect fail in some cases
  useEffect(() => {
    // remove all websockets if the Host is changed
    if (!selectedHost) return;
    connect_rheed((`ws://${selectedHost}/RHEED/data/live`), "arraybuffer");
    connect_log((`ws://${selectedHost}/chamber/live`), "arraybuffer");
    connect_analyzer((`ws://${selectedHost}/RHEED/analysis/live`), "arraybuffer");
  }, [selectedHost]);

  return (
    <WebSocketContext.Provider value={null}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default MainWebsocketsProvider;
