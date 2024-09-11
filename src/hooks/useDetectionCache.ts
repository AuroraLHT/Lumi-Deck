// import { useCallback, useEffect, useState } from "react";
// import useWebSocketStore from "../stores/websocket";
import useDetectorStore from "../clients/detector";


const useDetectionCache = () => {
  const store = useDetectorStore();
  const cache = store.cache;
  return { cache, };
};

export default useDetectionCache;
