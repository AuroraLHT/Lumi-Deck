interface DetectionRectangleProps {
  id: string;
  bbox: number[];
  cropSetup: { sx: number; sy: number; ex: number; ey: number } | null;
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

const DetectionRect = ({ id, bbox, cropSetup }: DetectionRectangleProps) => {
  bbox = correctBbox(bbox, cropSetup);

  const [sx, sy, ex, ey] = bbox;
  const w = ex - sx;
  const h = ey - sy;

  return (
    <rect
      id={id}
      className="detection-bbox"
      fill="none"
      stroke="purple"
      strokeWidth="2"
      data-original-stroke="purple"
      x={sx}
      y={sy}
      width={w}
      height={h}
    />
  );
};

export default DetectionRect;
