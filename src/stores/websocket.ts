// websocketStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface WebSocketInfo {
  socket: WebSocket;
  host: string;
  binaryType : "arraybuffer" | "blob"
}

interface WebSocketState {
  websockets: Record<string, WebSocketInfo>; // Map of WebSocket connections
  getWebSocket: (id: string) => WebSocketInfo | undefined;
  addWebSocket: (id: string, host: string, binaryType : "arraybuffer" | "blob") => void;
  removeWebSocket: (id: string) => void;
  disconnectAll: () => void;
}

const useWebSocketStore = create(
  immer<WebSocketState>((set, get) => ({
    websockets: {},

    getWebSocket: (id: string) => {
      return get().websockets[id];
    },

    addWebSocket: (id: string, host: string, binaryType: "arraybuffer" | "blob"
    ) => {
      set((state) => {
        // Close existing WebSocket if it exists for this ID
        const existingWebSocket = state.websockets[id];
        if (existingWebSocket) {
          existingWebSocket.socket.close();
        }

        // Create a new WebSocket connection
        const newSocket = new WebSocket(host);
        newSocket.binaryType = binaryType

        newSocket.onopen = () => console.log(`WebSocket ${id} connected to ${host}`);
        newSocket.onclose = () => console.log(`WebSocket ${id} disconnected`);
        newSocket.onerror = (error) => console.error(`WebSocket ${id} error:`, error);

        state.websockets[id] = { socket: newSocket, host, binaryType }; // Use Immer to mutate state
      });
    },

    removeWebSocket: (id: string) => {
      set((state) => {
        const webSocketInfo = state.websockets[id];
        if (webSocketInfo) {
          webSocketInfo.socket.close();
        }
        delete state.websockets[id]; // Immer allows direct mutation
      });
    },

    disconnectAll: () => {
      set((state) => {
        Object.values(state.websockets).forEach(({ socket }) => socket.close());
        state.websockets = {}; // Clear all WebSockets
      });
    },
  }))
);

export default useWebSocketStore;
