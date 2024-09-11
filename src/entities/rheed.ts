export interface RHEEDHeader {
    frag_idx: number;
    frame_end: string;
    frame_start: string;
    index?: number;
    size?: number;
}

export type RHEEDFragmentBase = {
    header: RHEEDHeader;
    payload: ArrayBuffer;
}