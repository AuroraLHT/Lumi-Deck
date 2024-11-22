import { useRef, useEffect, useState } from "react";
import useRHEEDStore from "../clients/rheed";

const useRHEED = (videoRef: React.RefObject<HTMLVideoElement>) => {

  const mediaRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  // const queueRef = useRef<ArrayBuffer[]>([]);
  const fragId = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const rheedStore = useRHEEDStore();
  // console.log("rheedStore.cache length", rheedStore.cache.length);

  const appendBuffer = (videoRef: React.RefObject<HTMLVideoElement>, sourceBufferRef: React.RefObject<SourceBuffer>, content: ArrayBuffer) => {
    let success = false;
    try {
      setIsUpdating(true);
      sourceBufferRef.current?.appendBuffer(content!);
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

  useEffect(() => {
    if (!isUpdating && isReady && !sourceBufferRef.current?.updating) {
      if (fragId.current < rheedStore.initialFragmentsLastId) {
        const fragment = rheedStore.initialFragments.filter((fragment) => fragment.header.frag_idx > fragId.current)[0];
        if (fragment) {
          appendBuffer(videoRef, sourceBufferRef, fragment.payload);
          fragId.current = fragment.header.frag_idx;
          // console.log("RHEEDClient appending initial fragment", fragId.current);
        };

      } else {
        const frag = rheedStore.getFrag();
        if (frag) {
          appendBuffer(videoRef, sourceBufferRef, frag.payload);
          fragId.current = frag.header.frag_idx;
          // console.log("RHEEDClient appending cache fragment", fragId.current);
        }
      }
    }
  }, [isUpdating, rheedStore.initialFragments, rheedStore.cache, isReady]);


  return { isReady };
};

export default useRHEED;
