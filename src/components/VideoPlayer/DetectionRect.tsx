import { useState } from "react";
import styles from "./VideoPlayer.module.css";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import { DetectionBBox } from "../../entities/detector";

interface DetectionRectangleProps {
  id: string;
  detection: DetectionBBox;
  cropSetup: { sx: number; sy: number; ex: number; ey: number } | null;
  frameWidth: number;
  frameHeight: number;
}

function correctBbox(
  bbox_xyxy: number[],
  crop_setup: { sx: number; sy: number; ex: number; ey: number } | null
) {
  if (crop_setup === null) {
    // console.log("crop_setup is null");
    crop_setup = { sx: 0, sy: 0, ex: 0, ey: 0 };
  }
  // console.log("crop_setup",  crop_setup);

  bbox_xyxy = [...bbox_xyxy];
  bbox_xyxy[0] += crop_setup.sy;
  bbox_xyxy[1] += crop_setup.sx;
  bbox_xyxy[2] += crop_setup.sy;
  bbox_xyxy[3] += crop_setup.sx;
  return bbox_xyxy;
}

const DetectionRect = ({ id, detection, cropSetup, frameWidth, frameHeight }: DetectionRectangleProps) => {
  // const store = useLiveAnalysisStore();
  // const addSelectedDetection = store.addSelectedDetection;
  const addSelectedDetection = useLiveAnalysisStore(state => state.addSelectedDetection);

  const bbox = correctBbox(detection.bbox, cropSetup);
  const [sx, sy, ex, ey] = bbox;
  const w = ex - sx;
  const h = ey - sy;

  const relativeX = (sx / frameWidth) * 100;
  const relativeY = (sy / frameHeight) * 100;
  const relativeWidth = (w / frameWidth) * 100;
  const relativeHeight = (h / frameHeight) * 100;

  const [isHovered, setIsHovered] = useState(false);

  return (
    <rect
      id={id}
      className={`${styles['rect-detection']} detection-bbox`}
      fill="none"
      stroke={isHovered ? "yellow" : "purple"}
      strokeWidth={isHovered ? "3" : "2"}
      data-original-stroke="purple"
      x={`${relativeX}%`}
      y={`${relativeY}%`}
      width={`${relativeWidth}%`}
      height={`${relativeHeight}%`}      
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        console.log(`Clicked on detection box ${id}`);
        addSelectedDetection(detection);
        // You can add more functionality here, such as:
        // - Updating a state
        // - Triggering a modal
        // - Sending data to a parent component
      }}
      
    />
  );
};

export default DetectionRect;
