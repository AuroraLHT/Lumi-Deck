import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import useLiveAnalysisStore from "../../stores/liveAnalysis";
import { DetectionBBox } from "../../entities/detector";
import useRheedNodeStore from '../../stores/nodes/rheed';
import useAnalyzerControl from '../../hooks/useAnalyzerControl';

const cvtRectangleToDetection = (rect: Rectangle, frameHeight: number, frameWidth: number): DetectionBBox => {
  const x1 = rect.scaledStartX * frameWidth;
  const x2 = (rect.scaledStartX + rect.scaledWidth) * frameWidth;
  const y1 = rect.scaledStartY * frameHeight;
  const y2 = (rect.scaledStartY + rect.scaledHeight) * frameHeight;

  return {
    bbox: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)],
    label: -1,
    score: 1,
  }
}

/**
 * Screen pixels a drag must cover before it counts as a rectangle.
 *
 * A click that moves a pixel or two is a click, not a box. It used to register
 * as a degenerate region anyway (widened to 1px by `toBBox`), which was merely
 * untidy when it created a new box -- but redraw *replaces* geometry, so a
 * mis-click on the video would otherwise shrink a working box to a dot and drop
 * the node's series for it.
 */
const MIN_DRAG_PX = 4;

export interface Rectangle {
  startX: number;
  startY: number;
  width: number;
  height: number;
  scaledStartX: number;
  scaledStartY: number;
  scaledWidth: number;
  scaledHeight: number;
}

interface Position {
    x: number;
    y: number;
    scaledX: number;
    scaledY: number;
}

/**
 * The drag-to-draw overlay on the RHEED video.
 *
 * Serves two modes. Normally a finished drag creates a new box. When the
 * analyzer has armed `redrawTargetID`, the same drag instead *moves* that box:
 * same id, same name, same analysis toggles, new coordinates -- and the new
 * geometry is pushed straight to whichever capabilities are running over it.
 */
const RectangleSelector: React.FC = () => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const containerRef = useRef<SVGSVGElement>(null);
  const startPos = useRef< Position | null>(null);
  const rheedNodeState = useRheedNodeStore((s) => s.state);

  const addSelectedDetection = useLiveAnalysisStore(
    (state) => state.addSelectedDetection
  );
  const redrawTargetID = useLiveAnalysisStore((s) => s.redrawTargetID);
  const cancelRedraw = useLiveAnalysisStore((s) => s.cancelRedraw);
  const { applyGeometryChange } = useAnalyzerControl();

  // Escape backs out of a redraw. Without it the only way to disarm is to draw
  // something, which is the one thing a user who armed it by mistake does not
  // want to do.
  useEffect(() => {
    if (!redrawTargetID) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelRedraw();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redrawTargetID, cancelRedraw]);

  const getRelativeCoordinates = (event: MouseEvent | React.MouseEvent) : Position => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0, scaledX: 0, scaledY: 0 };

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return {
      x: x,
      y: y,
      scaledX: x / rect.width,
      scaledY: y / rect.height,
    };
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDrawing(true);
    const pos = getRelativeCoordinates(event);
    startPos.current = pos;
    setRectangle({
      startX: pos.x,
      startY: pos.y,
      width: 0,
      height: 0,
      scaledStartX: pos.scaledX,
      scaledStartY: pos.scaledY,
      scaledWidth: 0,
      scaledHeight: 0
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDrawing || !startPos.current) return;

    const currentPos = getRelativeCoordinates(event);
    setRectangle({
      startX: startPos.current.x,
      startY: startPos.current.y,
      width: currentPos.x - startPos.current.x,
      height: currentPos.y - startPos.current.y,
      scaledStartX: startPos.current.scaledX,
      scaledStartY: startPos.current.scaledY,
      scaledWidth: currentPos.scaledX - startPos.current.scaledX,
      scaledHeight: currentPos.scaledY - startPos.current.scaledY
    });
  };

  const onSelectionComplete = useCallback((rect: Rectangle): void => {
    if (Math.abs(rect.width) < MIN_DRAG_PX || Math.abs(rect.height) < MIN_DRAG_PX) {
      return;
    }

    const detection = cvtRectangleToDetection(
      rect,
      rheedNodeState.frame_dims[0],
      rheedNodeState.frame_dims[1]
    );

    // Read the target through getState rather than the subscribed value: the
    // drag started before this callback was built, and arming can change under
    // it (another client removing the box, Escape) without a re-render landing
    // first.
    const store = useLiveAnalysisStore.getState();
    const targetID = store.redrawTargetID;

    if (!targetID) {
      addSelectedDetection(detection);
      return;
    }

    store.setDetectionBBox(targetID, detection.bbox);
    const updated = useLiveAnalysisStore.getState().selectedDetection[targetID];
    if (updated) applyGeometryChange(updated);
  }, [addSelectedDetection, applyGeometryChange, rheedNodeState]);

  const handleMouseUp = () => {
    setIsDrawing(false);
    if (rectangle) {
      onSelectionComplete(rectangle);
    }
    setRectangle(null);
  };

  // Redrawing an existing box draws in the accent colour, so it reads as "this
  // replaces something" rather than "this adds one more".
  const stroke = redrawTargetID ? "#3b82f6" : "red";

  return (
    <Box
      as="svg"
      ref={containerRef}
      position="absolute"
      top="0"
      left="0"
      width="100%"
      height="100%"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      cursor="crosshair"
      pointerEvents="all"
    >
      {rectangle && (
        <>
          <rect
            x={Math.min(rectangle.startX, rectangle.startX + rectangle.width)}
            y={Math.min(rectangle.startY, rectangle.startY + rectangle.height)}
            width={Math.abs(rectangle.width)}
            height={Math.abs(rectangle.height)}
            fill={redrawTargetID ? "rgba(59, 130, 246, 0.12)" : "rgba(255, 0, 0, 0.1)"}
            stroke={stroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={rectangle.startX + rectangle.width / 2}
            y={rectangle.startY + rectangle.height + 20}
            textAnchor="middle"
            fill="white"
            stroke="black"
            strokeWidth="0.5"
            fontSize="12px"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            {`${Math.abs(Math.round(rectangle.width))} x ${Math.abs(Math.round(rectangle.height))}`}
          </text>
        </>
      )}
    </Box>
  );
};

export default RectangleSelector;
