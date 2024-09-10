import { useCallback, useEffect, useRef, useState } from "react";
import useWebSocketStore from "../stores/websocket";

export type Log = { [key: string]: string}
export type Logs = Log[]

const useLog = () => {
  const logLimit = 2000;
  // const logsRef = useRef<Logs>([] as Logs);
  const [recentLog, setRecentLog] = useState<Log>({});
  const [logs, setLogs] = useState<Logs>([] as Logs);

  const handleLogMessage = useCallback((event: MessageEvent) => {
    // console.log(event);
    const payload = JSON.parse(event.data);
    // console.log("before", payload, typeof payload);

    const logPayload = payload as Log
    // console.log("payload", logPayload, typeof logPayload);

    // console.log("#logs before", logsRef.current.length);
    // console.log("#logs before", logs.length);
    setLogs((logs) => [...logs, logPayload]);
    // logsRef.current.push(logPayload);
    // console.log("#logs after", logsRef.current.length);
    // console.log("#logs after", logs.length);
    setRecentLog(logPayload);
    // setLogs([...logs.slice(-logLimit+1), logPayload]);

  }, []);

  // socket created by this getWebsocket would not be updated by React 
  // const getWebSocket  = useWebSocketStore( s => s.getWebSocket );
  const { getWebSocket } = useWebSocketStore();
  const socket = getWebSocket('log');
  
  useEffect(() => {
    console.log("log socket", socket, Math.random());
    if (socket) {
      console.log("log socket", socket, "is open", socket.socket.readyState);
      socket.socket.onmessage = handleLogMessage;
      socket.socket.onopen = () => {socket.socket.send("start_streaming"); console.log("log socket start streaming"); };
      socket.socket.onclose = () => {console.log("log socket closed"); };
    }
  }, [socket]);

  return { recentLog, logs };
};

export default useLog;
