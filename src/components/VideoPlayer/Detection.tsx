import { useCallback, useRef } from "react";
import DetectionRect from "./DetectionRect";
// import useDetection from "../../hooks/useDetection";
import useDetection from "../../hooks/useDetectionv2";

import { Spinner } from "@chakra-ui/react";
import styles from "./VideoPlayer.module.css";
import useDetectorNodeStore from "../../stores/nodes/detector";
import React from "react";


// Memoize the DetectionRect component
const MemoizedDetectionRect = React.memo(DetectionRect);

const Detection = () => {
  // const { bboxes, cropSetup, isConnected } = useDetection();
  const { bboxes, cropSetup, socket } = useDetection();

  const detectorNodeState = useDetectorNodeStore( s => s.state );

  const svgRef = useRef<SVGSVGElement>(null);

  // useEffect(() => {
  //   console.log("bboxes", bboxes);
  // }, [bboxes]);

  const renderDetectionRects = useCallback( () => {
    if (!detectorNodeState.is_streaming || !detectorNodeState.is_running || !detectorNodeState.is_available) {
      return null; // Don't render anything if not streaming
    }

    return Object.entries(bboxes).map(([id, bbox]) => (
      // <DetectionRect key={id} id={id} bbox={bbox.bbox} cropSetup={cropSetup} />
      <MemoizedDetectionRect key={id} id={id} bbox={bbox.bbox} cropSetup={cropSetup} />
    ));
  }, [bboxes, cropSetup, detectorNodeState]);

  return (
    <>
      {socket ? null : <Spinner />}
      {/* {isConnected ? null : <Spinner />} */}
      <svg ref={svgRef} className={styles['svg-detection']} xmlns="http://www.w3.org/2000/svg">
        {/* {Object.entries(bboxes).map(([id, bbox]) => (
          <DetectionRect key={id} id={id} bbox={bbox.bbox} cropSetup={cropSetup} />
        ))} */}
        {renderDetectionRects()}
      </svg>
    </>
  );
};

export default Detection;
