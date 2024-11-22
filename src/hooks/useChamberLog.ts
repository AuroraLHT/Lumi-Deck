// import { useCallback, useEffect, useRef, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
// import useChamberLogStore from "../clients/chamber/chamberLog";
import useChamberClient from "../clients/chamber/chamber";

export type Log = { [key: string]: string}
export type Logs = Log[]

const useLog = () => {
  const logs = useChamberClient((s) => s.cacheLogs );
  const recentLog = useChamberClient((s) => s.log);
  // console.log("chamber log length:", logs.length);
  return { recentLog, logs };
};

export default useLog;
