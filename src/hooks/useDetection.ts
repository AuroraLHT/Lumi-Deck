import { useCallback, useEffect, useState } from "react";
import useAppStore from "../stores/app";
import useWebSocketStore from "../stores/websocket";
import useDetectorNodeStore from "../stores/nodes/detector";

interface DetectionBBox {
    bbox:number[];
    label:number;
    score:number;
    // TODO: add other fields (mask)
}

type Bboxes = { [key: string]: DetectionBBox };

interface DetectionPayload {
  bboxes: Bboxes;
  classification: { [key: string]: string };
  region2tracks: { [key: string]: string };
}

interface DetectionHeader {
  crop_setup_sx: number;
  crop_setup_sy: number;
  crop_setup_ex: number;
  crop_setup_ey: number;
}

const useDetection = () => {
  const { selectedHost } = useAppStore();
  // const detectorNodeState  = useDetectorNodeStore( s => s.state );
  const [bboxes, setBboxes] = useState<Bboxes>({} as Bboxes);
  const [cropSetup, setCropSetup] = useState<{
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  } | null>(null);

  const handleDetectionMessage = useCallback((event: MessageEvent) => {
    // console.log(!detectorNodeState.is_streaming, !detectorNodeState.is_running, !detectorNodeState.is_available);
    // if (!detectorNodeState.is_streaming || !detectorNodeState.is_running || !detectorNodeState.is_available) {
    //   console.log("return");
    //   return;
    // }
    // console.log(event);

    const arrayBuffer = event.data;

    // Read the header length (4 bytes)
    const headerLength = new DataView(arrayBuffer, 0, 4).getUint32(0);

    // Read the header JSON
    const headerJson = new TextDecoder().decode(
      arrayBuffer.slice(4, 4 + headerLength)
    );
    let header = JSON.parse(headerJson);

    const payloadJson = new TextDecoder().decode(
      arrayBuffer.slice(4 + headerLength)
    );
    let payload = JSON.parse(payloadJson);

    // console.log("before", payload, typeof payload);
    // console.log("before", header, typeof header);

    const detectionPayload = payload as DetectionPayload;
    const detectionHeader = header as DetectionHeader;

    // console.log("after", detectionHeader, typeof detectionHeader);
    // console.log("after", detectionPayload, typeof detectionPayload);

    var bboxes = detectionPayload.bboxes;


    setBboxes(bboxes);    
    setCropSetup({
      sx: detectionHeader.crop_setup_sx,
      sy: detectionHeader.crop_setup_sy,
      ex: detectionHeader.crop_setup_ex,
      ey: detectionHeader.crop_setup_ey,
    });

  }, []);

  const connectWS = useWebSocketStore(s => s.connect);
  const { isConnected, sendMessage } = connectWS("detection", {
    url: (selectedHost && `ws://${selectedHost}/RHEED/detection/live`) || "",
    binaryType: "arraybuffer",
    onMessage: handleDetectionMessage,
  });

  // if the websocket is disconnected, clear the bboxes
  // useEffect(() => {
  //   if (!isConnected || !detectorNodeState.is_streaming || !detectorNodeState.is_running || !detectorNodeState.is_available) {
  //       setBboxes({} as Bboxes);
  //   }
  // }, [isConnected, detectorNodeState, bboxes]);

  return { bboxes, cropSetup, isConnected, sendMessage };
};

export default useDetection;
