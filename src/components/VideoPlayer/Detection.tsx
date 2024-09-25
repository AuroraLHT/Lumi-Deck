import { useCallback, useRef } from "react";
import DetectionRect from "./DetectionRect";
import useDetection from "../../hooks/useDetection";

import { Spinner } from "@chakra-ui/react";
import styles from "./VideoPlayer.module.css";
import useDetectorNodeStore from "../../stores/nodes/detector";
import useRheedNodeStore from "../../stores/nodes/rheed";
import React from "react";


// Memoize the DetectionRect component
const MemoizedDetectionRect = React.memo(DetectionRect);

const Detection = () => {
  // const { bboxes, cropSetup, isConnected } = useDetection();
  const { bboxes, cropSetup, socket } = useDetection();
  
  const detectorNodeState = useDetectorNodeStore( s => s.state );
  const rheedNodeState = useRheedNodeStore( s => s.state );

  const svgRef = useRef<SVGSVGElement>(null);

  // useEffect(() => {
  //   console.log("bboxes", bboxes);
  // }, [bboxes]);

  const renderDetectionRects = useCallback( () => {
    if (!detectorNodeState.is_streaming || !detectorNodeState.is_running || !detectorNodeState.is_available) {
      return null; // Don't render anything if not streaming
    }

    // console.log("detectorNodeState", detectorNodeState);

    return Object.entries(bboxes).map(([id, bbox]) => (
      // <DetectionRect key={id} id={id} detection={bbox} cropSetup={cropSetup} frameHeight={rheedNodeState.frame_dims[0]} frameWidth={rheedNodeState.frame_dims[1]}/>
      <MemoizedDetectionRect key={id} id={id} detection={bbox} cropSetup={cropSetup} frameHeight={rheedNodeState.frame_dims[0]} frameWidth={rheedNodeState.frame_dims[1]} />
    ));
  }, [bboxes, cropSetup, detectorNodeState]);

  return (
    <>
      {socket ? null : <Spinner />}
      {/* {isConnected ? null : <Spinner />} */}
      <svg ref={svgRef} className={styles['svg-detection']} xmlns="http://www.w3.org/2000/svg">
        {renderDetectionRects()}
      </svg>
    </>
  );
};

export default Detection;
