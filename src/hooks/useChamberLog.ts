import { useCallback, useState } from "react";
import useAppStore from "../stores/app";
import useWebSocketStore from "../stores/websocket";

type Log = {string: string}

const useLog = () => {
  const { selectedHost } = useAppStore();
  const [log, setLog] = useState<Log>({} as Log);

  const handleLogMessage = useCallback((event: MessageEvent) => {
    // console.log(event);
    const payload = JSON.parse(event.data);
    console.log("before", payload, typeof payload);

    const logPayload = payload as Log
    console.log("after", logPayload, typeof logPayload);

    setLog(logPayload);
  }, []);

  const connectWS = useWebSocketStore(s => s.connect);
  const { isConnected, sendMessage } = connectWS("log", {
    url: (selectedHost && `ws://${selectedHost}/chamber/log/live`) || "",
    binaryType: "blob",
    onMessage: handleLogMessage,
  });

  return { log, isConnected, sendMessage };
};

export default useLog;
