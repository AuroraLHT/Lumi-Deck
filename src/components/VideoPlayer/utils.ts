export function correctBbox(
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

export function getRelativeBbox(bbox_xyxy: number[], frameWidth: number, frameHeight: number) {
    const [sx, sy, ex, ey] = bbox_xyxy;
    const w = ex - sx;
    const h = ey - sy;
  
    const relativeX = (sx / frameWidth) * 100;
    const relativeY = (sy / frameHeight) * 100;
    const relativeWidth = (w / frameWidth) * 100;
    const relativeHeight = (h / frameHeight) * 100;

    return { relativeX, relativeY, relativeWidth, relativeHeight };
  }
