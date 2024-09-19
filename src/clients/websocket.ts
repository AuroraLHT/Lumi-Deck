// import { StateCreator } from "zustand";

export interface WebSocketStore {
  socket: WebSocket | null;
  host: string;
  binaryType : "arraybuffer" | "blob"
  isConnected: boolean;
  setIsConnected: (isConnected: boolean) => void;
  connectWebSocket: (host: string, binaryType : "arraybuffer" | "blob") => void;
  disconnectWebSocket: () => void;
}

