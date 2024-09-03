import { useCallback, useEffect, useState } from "react";
import useWebSocketStore from "../stores/websocket_v2";

type Log = {string: string}

const useLog = () => {
  const [log, setLog] = useState<Log>({} as Log);

  const handleLogMessage = useCallback((event: MessageEvent) => {
    // console.log(event);
    const payload = JSON.parse(event.data);
    console.log("before", payload, typeof payload);

    const logPayload = payload as Log
    console.log("after", logPayload, typeof logPayload);

    setLog(logPayload);
  }, []);

  const getWebSocket  = useWebSocketStore( s => s.getWebSocket );
  const socket = getWebSocket('log');
  
  useEffect(() => {
    if (socket) {
      socket.socket.onmessage = handleLogMessage;
    }
  }, [socket]);

  return { log };
};

export default useLog;
