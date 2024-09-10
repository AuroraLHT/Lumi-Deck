// websocketStore.ts

export interface WebSocketStore {
  socket: WebSocket | null;
  host: string;
  binaryType : "arraybuffer" | "blob"
  isConnected: boolean;
  connectWebSocket: (host: string, binaryType : "arraybuffer" | "blob") => void;
  disconnectWebSocket: () => void;
}
