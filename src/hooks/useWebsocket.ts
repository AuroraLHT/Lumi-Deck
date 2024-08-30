import { useEffect, useRef, useState } from 'react';

export interface UseWebSocketProps {
  url: string;
  binaryType : "arraybuffer" | "blob"
  onMessage: (event: MessageEvent) => void;
}

export interface WebSocketConnection {
  isConnected: boolean;
  sendMessage: (message: string) => void;
  disconnect: () => void;
  reconnect: () => void;
}

const useWebSocket = ({ url, binaryType, onMessage }: UseWebSocketProps) : WebSocketConnection => {
/**
 * A custom hook for managing WebSocket connections.
 * 
 * @param {Object} props - The properties for the WebSocket connection.
 * @param {string} props.url - The URL of the WebSocket server to connect to.
 * @param {('arraybuffer'|'blob')} props.binaryType - The type of binary data being transmitted.
 * @param {function} props.onMessage - Callback function to handle incoming messages.
 * 
 * @returns {Object} An object containing:
 *   - isConnected: A boolean indicating whether the WebSocket is currently connected.
 *   - sendMessage: A function to send messages through the WebSocket.
 */
  const socketRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // the websocket will try to reconnect if the connectCount is incremented
  const [connectCount, setConnectCount] = useState(0);

  // Optional: Send messages through WebSocket
  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    }
  };

  const disconnect = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.close();
    }
  }

  const connect = () => {
    // close the websocket if it is already connected
    disconnect();

    const socket = new WebSocket(url);
    socket.binaryType = binaryType
    socketRef.current = socket;

    // Connection established
    socket.onopen = () => {
      console.log(`Connected to WebSocket ${url}`);
      setIsConnected(true);
    };

    // Handle incoming messages
    socket.onmessage = (event) => {
      onMessage(event);
    };

    // Handle connection close
    socket.onclose = () => {
      setIsConnected(false);
    };

    return socket;
  }

  const reconnect = () => {
    if (!isConnected) {
      setConnectCount(connectCount+ 1);
    }
  }

  useEffect(() => {
    if (!url) return;

    // Establish WebSocket connection
    const socket = connect();

    // Cleanup WebSocket when the component unmounts or host changes
    return () => {
      socket.close();
    };
  }, [url, binaryType, onMessage, connectCount]);



  return { isConnected, sendMessage, disconnect, reconnect };
};

export default useWebSocket;