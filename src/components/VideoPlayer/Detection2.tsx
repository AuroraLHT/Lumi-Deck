import React, { useCallback, useRef, useMemo } from "react";
import useDetection from "../../hooks/useDetection";
import { Spinner } from "@chakra-ui/react";
import styles from "./VideoPlayer.module.css";
import useDetectorNodeStore from "../../stores/nodes/detector";
import useRheedNodeStore from "../../stores/nodes/rheed";

const Detection = () => {
  const { bboxes, socket } = useDetection();
  const detectorNodeState = useDetectorNodeStore(s => s.state);
  const rheedNodeState = useRheedNodeStore(s => s.state);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shouldRenderDetections = useMemo(() => {
    return detectorNodeState.is_streaming && detectorNodeState.is_running && detectorNodeState.is_available;
  }, [detectorNodeState.is_streaming, detectorNodeState.is_running, detectorNodeState.is_available]);

  const renderDetections = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldRenderDetections) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up the canvas dimensions based on the frame dimensions
    canvas.width = rheedNodeState.frame_dims[1];
    canvas.height = rheedNodeState.frame_dims[0];

    // Draw the detections
    Object.values(bboxes).forEach(bbox => {
      const [x, y, w, h] = bbox.bbox;
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    });
  }, [bboxes, shouldRenderDetections, rheedNodeState.frame_dims]);

  // Use requestAnimationFrame for smooth rendering
  React.useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      renderDetections();
      animationFrameId = requestAnimationFrame(animate);
    };

    if (shouldRenderDetections) {
      animate();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [renderDetections, shouldRenderDetections]);

  return (
    <>
      {!socket && <Spinner />}
      {shouldRenderDetections && (
        <canvas
          ref={canvasRef}
          className={styles['canvas-detection']}
        />
      )}
    </>
  );
};

export default Detection;