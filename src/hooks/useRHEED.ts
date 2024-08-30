import { useRef, useEffect, useState, useCallback } from "react";
import useAppStore from "../stores/app";
import useWebSocketStore from "../stores/websocket";

const useRHEED = () => {
  const { selectedHost } = useAppStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const [isReady, setIsReady] = useState(false);

  const queueRef = useRef<ArrayBuffer[]>([]);
  //   const queue: ArrayBuffer[] = [];

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (mediaRef.current) {
      const mediaSource = mediaRef.current;
      if (mediaSource.readyState === "open") {
        // Append the received data to the SourceBuffer
        // console.log("add to queue");
        queueRef.current.push(event.data);
        // sourceBuffer.appendBuffer(event.data);

        if (queueRef.current.length > 0 && !sourceBufferRef.current?.updating) {
          let content = queueRef.current.shift();
        //   console.log("append", content?.byteLength);
          sourceBufferRef.current?.appendBuffer(content!);
        }
      } else {
        console.log(
          "Media source is not in open state: ",
          mediaSource.readyState
        );
      }
    }
  }, []);
  
  const connectWS = useWebSocketStore((s) => s.connect);
  const { isConnected, sendMessage, disconnect } = connectWS("rheed", {
    url: (selectedHost && `ws://${selectedHost}/RHEED/cam/live`) || "",
    binaryType: "arraybuffer",
    onMessage: handleWebSocketMessage,
  });

  useEffect(() => {
    // console.log("videoRef.current", videoRef.current);

    if (videoRef.current) {
    //   console.log("videoRef.current", videoRef.current);
      if (isConnected) {
        // console.log("isConnected", isConnected);
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
            if (queueRef.current.length > 0 && !sourceBuffer.updating) {
              let content = queueRef.current.shift();
            //   console.log("append", content?.byteLength);
              sourceBuffer.appendBuffer(content!);
            }
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
        setIsReady(false);
      }
    }
  }, [isConnected, videoRef]);

  return { videoRef, isReady, isConnected, sendMessage, disconnect };
};

export default useRHEED;
