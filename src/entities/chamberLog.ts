export type Log = { [key: string]: string}
export type Logs = Log[]

export interface ChamberLogPayload extends Log {}
export interface ChamberLogPayloadHeader {
    type: string;
    success: boolean;
}