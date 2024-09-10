import { useState } from "react";

interface DetectionRectangleProps {
  id: string;
  bbox: number[];
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

function correctFrameDims(
  frameHeight: number,
  frameWidth: number,
  crop_setup: { sx: number; sy: number; ex: number; ey: number } | null
) {
  if (crop_setup === null) {
    // console.log("crop_setup is null");
    crop_setup = { sx: 0, sy: 0, ex: 0, ey: 0 };
  }
  // console.log("crop_setup",  crop_setup);

  frameHeight += crop_setup.sx;
  frameWidth += crop_setup.sy;
  return { frameHeight, frameWidth };
}


const DetectionRect = ({ id, bbox, cropSetup, frameWidth, frameHeight }: DetectionRectangleProps) => {
  bbox = correctBbox(bbox, cropSetup);
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
      className={`detection-bbox ${isHovered ? "hovered" : ""}`}
      fill="none"
      stroke={isHovered ? "yellow" : "purple"}
      strokeWidth={isHovered ? "3" : "2"}
      data-original-stroke="purple"
      // x={sx}
      // y={sy}
      // width={w}
      // height={h}
      x={`${relativeX}%`}
      y={`${relativeY}%`}
      width={`${relativeWidth}%`}
      height={`${relativeHeight}%`}      
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      
    />
  );
};

export default DetectionRect;
