import { useCallback, useRef, useState } from 'react';
import { Box } from '@chakra-ui/react';

import useLiveAnalysisStore from "../../stores/liveAnalysis";
import { DetectionBBox } from "../../entities/detector";
import useRheedNodeStore from '../../stores/nodes/rheed';

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

const RectangleSelector: React.FC = () => {
  const [isDrawing, setIsDrawing] = useState(false);
//   const [isDrawingEnded, setIsDrawingEnded] = useState(false);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const containerRef = useRef<SVGSVGElement>(null);
  const startPos = useRef< Position | null>(null);
  const rheedNodeState = useRheedNodeStore((s) => s.state);

  const addSelectedDetection = useLiveAnalysisStore(
    (state) => state.addSelectedDetection
  );
  


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
    console.log("handleMouseDown");
    setIsDrawing(true);
    // setIsDrawingEnded(false);
    const pos = getRelativeCoordinates(event);
    startPos.current = pos;
    console.log("startPos.current", startPos.current);
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
    // console.log("isDrawing", isDrawing);
    if (!isDrawing || !startPos.current) return;

    console.log("event", event);    
    console.log("startPos.current", startPos.current);
    const currentPos = getRelativeCoordinates(event);
    console.log("currentPos", currentPos);
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
    console.log("addManualBox", rect);
    const detection = cvtRectangleToDetection(rect, rheedNodeState.frame_dims[0], rheedNodeState.frame_dims[1]);
    console.log("detection", detection);
    addSelectedDetection(detection);
  }, [addSelectedDetection]);  

  const handleMouseUp = () => {
    console.log("handleMouseUp");

    // const pos = getRelativeCoordinates(event);
    // console.log("end pos", pos);
    // if (!startPos.current) return;
    // setRectangle({
    //   startX: startPos.current.x,
    //   startY: startPos.current.y,
    //   width: pos.x - startPos.current.x,
    //   height: pos.y - startPos.current.y
    // });

    setIsDrawing(false);
    // setIsDrawingEnded(true);
    if (rectangle) {
      onSelectionComplete(rectangle);
    }
  };

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
      cursor={isDrawing ? 'crosshair' : 'default'}
      pointerEvents="all"
    >
      {rectangle && (
        <>
          <rect
            x={Math.min(rectangle.startX, rectangle.startX + rectangle.width)}
            y={Math.min(rectangle.startY, rectangle.startY + rectangle.height)}
            width={Math.abs(rectangle.width)}
            height={Math.abs(rectangle.height)}
            fill="rgba(255, 0, 0, 0.1)"
            stroke="red"
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
