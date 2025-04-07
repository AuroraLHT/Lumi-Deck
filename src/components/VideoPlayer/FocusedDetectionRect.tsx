import styles from "./VideoPlayer.module.css";
// import useLiveAnalysisStore from "../../stores/liveAnalysis";
import { DetectionBBox } from "../../entities/detector";
import { getRelativeBbox, correctBbox } from "./utils";

interface DetectionRectangleProps {
  id: string;
  detection: DetectionBBox;
  cropSetup: { sx: number; sy: number; ex: number; ey: number } | null;
  frameWidth: number;
  frameHeight: number;
}

const DetectionRect = ({
  id,
  detection,
  cropSetup,
  frameWidth,
  frameHeight,
}: DetectionRectangleProps) => {
  // const store = useLiveAnalysisStore();
  // const addSelectedDetection = store.addSelectedDetection;

  const bbox = correctBbox(detection.bbox, cropSetup);
  const { relativeX, relativeY, relativeWidth, relativeHeight } =
    getRelativeBbox(bbox, frameWidth, frameHeight);
  //   const [sx, sy, ex, ey] = bbox;
  //   const w = ex - sx;
  //   const h = ey - sy;

  //   const relativeX = (sx / frameWidth) * 100;
  //   const relativeY = (sy / frameHeight) * 100;
  //   const relativeWidth = (w / frameWidth) * 100;
  //   const relativeHeight = (h / frameHeight) * 100;

  return (
    <rect
      id={id}
      className={`${styles["rect-detection"]} detection-bbox`}
      fill="none"
      stroke="red"
      strokeWidth="1"
      data-original-stroke="red"
      x={`${relativeX}%`}
      y={`${relativeY}%`}
      width={`${relativeWidth}%`}
      height={`${relativeHeight}%`}
    />
  );
};

export default DetectionRect;
