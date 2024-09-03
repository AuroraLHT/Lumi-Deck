// MyComponent.tsx
import React, { useEffect } from 'react';
import useWebSocketStore from '../stores/websocket_v2';
import useAppStore from '../stores/app';

interface MainWebsocketsProps {
  children: React.ReactNode;
}

export const WebSocketContext = React.createContext<WebSocket | null>(null);

const MainWebsocketsProvider: React.FC<MainWebsocketsProps> = ({ children }) => {
  const { addWebSocket, disconnectAll  } = useWebSocketStore();
  const { selectedHost } = useAppStore();

  // TODO: auto reload if the connect fail in some cases
  useEffect(() => {
    // remove all websockets if the Host is changed
    if (!selectedHost) return;
    disconnectAll();
    addWebSocket('rheed', `ws://${selectedHost}/RHEED/cam/live`, "arraybuffer");
    addWebSocket('log', `ws://${selectedHost}/chamber/log/live`, "blob");
    addWebSocket('detect', `ws://${selectedHost}/RHEED/detection/live`, "arraybuffer");
  }, [selectedHost]);

  return (
    <WebSocketContext.Provider value={null}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default MainWebsocketsProvider;
