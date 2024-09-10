import { useRef, useEffect, useState, useCallback } from "react";
import useWebSocketStore from "../stores/websocket";

const appendBuffer = (videoRef: React.RefObject<HTMLVideoElement>, sourceBufferRef: React.RefObject<SourceBuffer>, content: ArrayBuffer) => {
  let success = false;
  try {
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

const useRHEED = () => {
  const { getWebSocket } = useWebSocketStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const queueRef = useRef<ArrayBuffer[]>([]);
  //   const queue: ArrayBuffer[] = [];

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (mediaRef.current) {
      const mediaSource = mediaRef.current;
      if (mediaSource.readyState === "open") {
        // Append the received data to the SourceBuffer
        // console.log("add to queue");
        queueRef.current.push(event.data);
        // console.log( event.data );
        // sourceBuffer.appendBuffer(event.data);

        if (queueRef.current.length > 0 && !sourceBufferRef.current?.updating) {
          let content = queueRef.current.shift();
        //   console.log("append", content?.byteLength);
          // sourceBufferRef.current?.appendBuffer(content!);
          let success = appendBuffer(videoRef, sourceBufferRef, content!);
          // console.log("appendBuffer success", success);
          if (!success) { console.log("appendBuffer fail. buffer is full"), queueRef.current.push(content!); }
        }
      } else {
        console.log(
          "Media source is not in open state: ",
          mediaSource.readyState
        );
      }
    }
  }, []);

  const socket = getWebSocket("rheed");

  useEffect( () => {
    if (socket) {
      socket.socket.onmessage = handleWebSocketMessage;
      socket.socket.onopen = () => { setIsConnected(true); }
      socket.socket.onclose = () => { setIsConnected(false); }
    }
  }, [socket] )
  

  useEffect(() => {
    // console.log("videoRef.current", videoRef.current);

    if (videoRef.current) {
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
          
          socket?.socket.send("start_streaming")
          setIsReady(true);
        });
      } else {
        videoRef.current.src = "";
        mediaRef.current = null;
        sourceBufferRef.current = null;
                
        isConnected && socket?.socket.send("end_streaming")
        setIsReady(false);
      }
    }
  }, [isConnected, socket, videoRef]);

  return { videoRef, isReady };
};

export default useRHEED;
