
export interface DetectionBBox {
    bbox: number[];
    label: number;
    score: number;
    // TODO: add other fields (mask)
}

export type DetectionClassification = { [key: string]: string };
export type DetectionRegion2Tracks = { [key: string]: string };
export type DetectionBboxes = { [key: string]: DetectionBBox };

export interface DetectionPayload {
  bboxes: DetectionBboxes;
  classification: DetectionClassification;
  region2tracks: DetectionRegion2Tracks;
}

export interface DetectionHeader {
  crop_setup_sx: number;
  crop_setup_sy: number;
  crop_setup_ex: number;
  crop_setup_ey: number;
}
