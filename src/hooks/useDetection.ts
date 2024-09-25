// import { useCallback, useEffect, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useLiveAnalysisClient from "../clients/liveAnalysis/analyzer";


const useDetection = () => {
  // const detectorNodeState  = useDetectorNodeStore( s => s.state );
  // const store = useLiveAnalysisClient();
  const bboxes = useLiveAnalysisClient(s=>s.bboxes);
  const cropSetup = useLiveAnalysisClient(s=>s.cropSetup);
  const socket = useLiveAnalysisClient(s=>s.socket);
  const isConnected = useLiveAnalysisClient(s=>s.isConnected);
  // console.log(store.cache);
  return { bboxes, cropSetup, socket, isConnected };
};

export default useDetection;
