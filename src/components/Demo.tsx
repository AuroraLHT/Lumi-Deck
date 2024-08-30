import React, { useState, useCallback } from 'react';
import useAppStore from '../stores/app';
import useWebSocket from '../hooks/useWebsocket';

const DemoComponent: React.FC = () => {
  const { selectedHost, setSelectedHost } = useAppStore();
  const [message, setMessage] = useState<string | null>(null);

  // Define the callback to handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    // console.log(data);
    setMessage(`On message ${data}`);
    // setMessage("On message");
  }, []);

  // Use the custom WebSocket hook
  const { isConnected, sendMessage } = useWebSocket({
    url: selectedHost || '',
    binaryType : "arraybuffer",
    onMessage: handleWebSocketMessage,
  });

  return (
    <div>
      {/* Dropdown to select a host */}
      <select
        value={selectedHost || ''}
        onChange={(e) => setSelectedHost(e.target.value)}
      >
        <option value="" disabled>Select a host</option>
        <option value="localhost:8000/RHEED/detection/live">localhost:8000/RHEED/detection/live</option>
        <option value="localhost:8000/chamber/log/live">localhost:8000/chamber/log/live</option>
      </select>

      {/* Show WebSocket status */}
      <p>WebSocket is {isConnected ? 'connected' : 'disconnected'}</p>

      {/* Display the received WebSocket message */}
      {message && <p>Message from WebSocket: {message}</p>}

      {/* Send message (optional) */}
      <button onClick={() => sendMessage('Hello from client')}>Send Message</button>
    </div>
  );
};

export default DemoComponent;
