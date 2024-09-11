// import { useCallback, useEffect, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useDetectorStore from "../clients/detector";


const useDetectionCache = () => {
  const store = useDetectorStore();
  const cache = store.cache;
  // console.log("detection cache length:", cache.length);
  // console.log("detection cache[0]:", cache[0]);
  return { cache, };
};

export default useDetectionCache;
