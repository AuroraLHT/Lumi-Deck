import { useCallback, useEffect, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useDetectorStore from "../clients/detector";


const useDetection = () => {
  // const detectorNodeState  = useDetectorNodeStore( s => s.state );
  const store = useDetectorStore();
  const bboxes = store.bboxes;
  const cropSetup = store.cropSetup;
  const socket = store.socket;
  const isConnected = store.isConnected;
  return { bboxes, cropSetup, socket, isConnected };
};

export default useDetection;
