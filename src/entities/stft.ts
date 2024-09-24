export interface STFTBase {
    fft_freq: number[];
    fft_mag: number[];
    fft_phase: number[];
    time_end: number;
    time_start: number;
    timestamp_end : string
    timestamp_start : string
    time_resolution: number;
}
  
  export interface STFTPayload {
    [key: string]: STFTBase;
  }
  
  export interface STFTHeader {
    stft_uuid: string;
  }
  
  export interface STFTCacheBase {
    content: STFTBase;
    header: STFTHeader;
  }
  
  export interface STFTCache {
    [key: string]: STFTCacheBase[];
  }
  