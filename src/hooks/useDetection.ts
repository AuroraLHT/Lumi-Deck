// import { useCallback, useEffect, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useLiveAnalysisClient from "../clients/liveAnalysis/detector";


const useDetection = () => {
  // const detectorNodeState  = useDetectorNodeStore( s => s.state );
  const store = useLiveAnalysisClient();
  const bboxes = store.bboxes;
  const cropSetup = store.cropSetup;
  const socket = store.socket;
  const isConnected = store.isConnected;
  // console.log(store.cache);
  return { bboxes, cropSetup, socket, isConnected };
};

export default useDetection;
