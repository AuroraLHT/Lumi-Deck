import { create } from "zustand";
import useWebSocket, { WebSocketConnection, UseWebSocketProps } from "../hooks/useWebsocket";


interface WebSocketStore {
  connections: Map<string, WebSocketConnection>;
  connect: (
    name: string,
    props : UseWebSocketProps
  ) => WebSocketConnection;
  disconnect: (name: string) => void;
  sendMessage: (name: string, message: string) => void;
  isConnected: (name: string) => boolean;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  connections: new Map(),
  connect: ( name, props : UseWebSocketProps ) => {
    const { isConnected, sendMessage, disconnect } = useWebSocket(props);

    set((state) => ({
      connections: new Map(state.connections).set(name, {
        isConnected,
        sendMessage,
        disconnect,
      }),
    }));
    return {
      isConnected,
      sendMessage,
      disconnect
    };

  },
  disconnect: (name) => {
    const connection = get().connections.get(name);
    if (connection) {
      connection.disconnect();
      set((state) => {
        const newConnections = new Map(state.connections);
        newConnections.delete(name);
        return { connections: newConnections };
      });
    }
  },
  sendMessage: (name, message) => {
    const connection = get().connections.get(name);
    if (connection) {
      connection.sendMessage(message);
    }
  },
  isConnected: (name) => {
    const connection = get().connections.get(name);
    return connection ? connection.isConnected : false;
  },
}));
