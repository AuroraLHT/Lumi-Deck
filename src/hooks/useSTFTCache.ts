// import { useCallback, useEffect, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useLiveAnalysisClient from "../clients/liveAnalysis/analyzer";


const useSTFTCache = () => {
  const cache = useLiveAnalysisClient(s=>s.cacheSTFT);
  // console.log("detection cache length:", cache.length);
  // console.log("detection cache[0]:", cache[0]);
  return { cache, };
};

export default useSTFTCache;
