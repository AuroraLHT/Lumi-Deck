import {
  BaseRequestMessageHeader,
  BaseControlRequestMessageHeader,
} from "../entities/backend";

export interface WebSocketHeader {
  target: string;
  operation: string;
  payload_type: "json" | "text" | "bytes";
}

export function encodeObjectToBuffer(obj: any): ArrayBuffer {
  const json = JSON.stringify(obj);
  const encoder = new TextEncoder();
  return encoder.encode(json);
}

export function parseHeader(arrayBuffer: ArrayBuffer): {
  header: any;
  remaining: ArrayBuffer;
} {
  const headerLength = new DataView(arrayBuffer, 0, 4).getUint32(0);
  const headerJson = new TextDecoder().decode(
    arrayBuffer.slice(4, 4 + headerLength)
  );
  const header = JSON.parse(headerJson);
  const remaining = arrayBuffer.slice(4 + headerLength);
  return { header, remaining };
}

export function parseWebSocketMessage(arrayBuffer: ArrayBuffer): {
  websocket_header: WebSocketHeader;
  payload_header: any;
  payload_content: ArrayBuffer;
} {
  // Read the header length (4 bytes)
  const { header: websocket_header, remaining: websocket_content } =
    parseHeader(arrayBuffer) as {
      header: WebSocketHeader;
      remaining: ArrayBuffer;
    };
  // Read the header JSON
  const {
    header: payload_header,
    remaining: payload_content,
  }: { header: any; remaining: ArrayBuffer } = parseHeader(websocket_content);

  return { websocket_header, payload_header, payload_content };
}

export function packHeader(header: any): ArrayBuffer {
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);
  const headerLength = headerBytes.length;
  const result = new ArrayBuffer(4 + headerLength);
  const view = new DataView(result);
  view.setUint32(0, headerLength);
  new Uint8Array(result, 4).set(headerBytes);
  return result;
}

export function packWebSocketMessage(
  websocket_header: WebSocketHeader,
  payload_header: any,
  payload_content: ArrayBuffer
): ArrayBuffer {
  const packedWebsocketHeader = packHeader(websocket_header);
  const packedPayloadHeader = packHeader(payload_header);

  const totalLength =
    packedWebsocketHeader.byteLength +
    packedPayloadHeader.byteLength +
    payload_content.byteLength;
  const result = new ArrayBuffer(totalLength);

  const resultView = new Uint8Array(result);
  resultView.set(new Uint8Array(packedWebsocketHeader), 0);
  resultView.set(
    new Uint8Array(packedPayloadHeader),
    packedWebsocketHeader.byteLength
  );
  resultView.set(
    new Uint8Array(payload_content),
    packedWebsocketHeader.byteLength + packedPayloadHeader.byteLength
  );

  return result;
}

export const prepareControlMessage = (
  target: string,
  controlType: string,
  controlPayload?: object
) => {
  const header: BaseControlRequestMessageHeader = {
    control_request_type: controlType,
    message_type: "control_request",
    message_timestamp: Date.now().toString(),
    message_source: "WS Client",
  };
  return packWebSocketMessage(
    {
      target: target,
      operation: "control_request",
      payload_type: "json",
    },
    header,
    controlPayload ? encodeObjectToBuffer(controlPayload) : new ArrayBuffer(0)
  );
};

export const prepareCommandMessage = (
  target: string,
  commandType: string,
  commandPayload?: object
) => {
  return packWebSocketMessage(
    {
      target: target,
      operation: "command",
      payload_type: "json",
    },
    { command_type: commandType },
    commandPayload ? encodeObjectToBuffer(commandPayload) : new ArrayBuffer(0)
  );
};

export const prepareRequestMessage = (
  target: string,
  requestType: string,
  requestPayload?: object
) => {
  const header : BaseRequestMessageHeader = { request_type: requestType, message_type: "request", message_timestamp: Date.now().toString(), message_source: "WS Client" };
  return packWebSocketMessage(
    {
      target: target,
      operation: "request",
      payload_type: "json",
    },
    header,
    requestPayload ? encodeObjectToBuffer(requestPayload) : new ArrayBuffer(0)
  );
};

export const logWebSocketMessage = (message: ArrayBuffer) => {
  const decoder = new TextDecoder('utf-8');
  const messageString = decoder.decode(message);
  console.log('Message:', messageString);
}