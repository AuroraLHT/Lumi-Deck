export interface IntegrationBase {
  mean: number;
  max: number;
  min: number;
  width: number;
  height: number;
}

export interface IntegrationPayload {
  [key: string]: IntegrationBase;
}

export interface IntegrationHeader {
  time_stamp: string;
  time: string;
  uuid: string;
}

export interface IntegrationCacheBase {
  content: IntegrationBase;
  header: IntegrationHeader;
}

export interface IntegrationCache {
  [key: string]: IntegrationCacheBase[];
}
