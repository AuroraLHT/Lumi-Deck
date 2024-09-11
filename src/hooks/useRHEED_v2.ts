import { useRef, useEffect, useState, useCallback } from "react";
// import useWebSocketStore from "../stores/websocket";
import useRHEEDStore from "../clients/rheed";





const useRHEED = () => {

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  // const queueRef = useRef<ArrayBuffer[]>([]);
  const fragId = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const rheedStore = useRHEEDStore();


  const appendBuffer = (videoRef: React.RefObject<HTMLVideoElement>, sourceBufferRef: React.RefObject<SourceBuffer>, content: ArrayBuffer) => {
    let success = false;
    try {
      sourceBufferRef.current?.appendBuffer(content!);
      setIsUpdating(true);
      success = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // Buffer is full, remove old data
        if (sourceBufferRef.current && sourceBufferRef.current.buffered.length > 0) {
          const removeStart = sourceBufferRef.current.buffered.start(0);
          const removeEnd = videoRef.current?.buffered.end(videoRef.current.buffered.length - 1) || 0;
          if (removeEnd > removeStart) {
            sourceBufferRef.current.remove(removeStart, removeEnd);
          }
        }
      } else {
        console.error('Error appending buffer:', error);
      }
    }
    return success;
  };

  useEffect(() => {
    // console.log("videoRef.current", videoRef.current);

    if (videoRef.current) {
      // console.log("isConnected", rheedStore.isConnected);
      if (rheedStore.isConnected) {
        var mediaSource = new MediaSource();
        videoRef.current.src = URL.createObjectURL(mediaSource);
        mediaRef.current = mediaSource;

        mediaSource.addEventListener("sourceopen", () => {
          let sourceBuffer = mediaSource.addSourceBuffer(
            'video/mp4; codecs="avc1.42E01E"'
          );
          sourceBufferRef.current = sourceBuffer;
          // ... rest of your mediaSource event listener code ...

          sourceBuffer.addEventListener("updateend", () => {
            setIsUpdating(false);
            // if (queueRef.current.length > 0 && !sourceBuffer.updating) {
            //   let content = queueRef.current.shift();
            //   //   console.log("append", content?.byteLength);
            //   sourceBuffer.appendBuffer(content!);
            // }
          });

          sourceBuffer.addEventListener("error", (event) => {
            console.error("SourceBuffer error:", event);
          });

          setIsReady(true);
        });
      } else {
        videoRef.current.src = "";
        mediaRef.current = null;
        sourceBufferRef.current = null;

        rheedStore.isConnected && rheedStore.socket?.send("end_streaming")
        setIsReady(false);
      }
    }

  }, [rheedStore.isConnected, rheedStore.socket, videoRef]);

  // useEffect(() => {
  //   // Loop through the cache and add fragments to the queue
  //   if (fragId.current === 0 && rheedStore.initialFragments.length > 0) {
  //     rheedStore.initialFragments.forEach((fragment) => {
  //       queueRef.current.push(fragment.payload);
  //       fragId.current = fragment.header.frag_idx;
  //     });
  //   } else if (fragId.current > 0 && rheedStore.cache.length > 0) {
  //     rheedStore.cache.filter((fragment) => fragment.header.frag_idx > fragId.current).forEach((fragment) => {
  //       queueRef.current.push(fragment.payload);
  //       fragId.current = fragment.header.frag_idx;
  //     }
  //     );
  //   }
  //   // Clear the cache after processing
  //   // rheedStore.clearCache();
  // }, [rheedStore.cache, rheedStore.fragment, rheedStore.initialFragments]);

  useEffect(() => {
    if (!isUpdating && isReady) {
      if (fragId.current < rheedStore.initialFragmentsLastId) {
        const fragment = rheedStore.initialFragments.filter((fragment) => fragment.header.frag_idx > fragId.current)[0];
        if (fragment) {
          appendBuffer(videoRef, sourceBufferRef, fragment.payload);
          fragId.current = fragment.header.frag_idx;
        };

      } else {
        const frag = rheedStore.getFrag();
        if (frag) {
          appendBuffer(videoRef, sourceBufferRef, frag.payload);
          fragId.current = frag.header.frag_idx;
        }
      }
    }
  }, [isUpdating, rheedStore.fragment, isReady]);


  return { videoRef, isReady };
};

export default useRHEED;
