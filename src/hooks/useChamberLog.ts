// import { useCallback, useEffect, useRef, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useChamberLogStore from "../clients/chamberLog";

export type Log = { [key: string]: string}
export type Logs = Log[]

const useLog = () => {
  const state = useChamberLogStore();
  const logs = state.cache;
  const recentLog = state.log;
  // console.log("chamber log length:", logs.length);
  return { recentLog, logs };
};

export default useLog;
