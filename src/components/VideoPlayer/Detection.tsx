import DetectionRect from "./DetectionRect";
import FocusedDetectionRect from "./FocusedDetectionRect";

import { Spinner } from "@chakra-ui/react";

import useDetectorNodeStore from "../../stores/nodes/detector";
import useRheedNodeStore from "../../stores/nodes/rheed";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useDetection from "../../hooks/useDetection";

import styles from "./VideoPlayer.module.css";

import { useCallback, useRef } from "react";
import React from "react";

// Memoize the DetectionRect component
const MemoizedDetectionRect = React.memo(DetectionRect);
const MemoizedFocusedDetectionRect = React.memo(FocusedDetectionRect);

const Detection = () => {
  // const { bboxes, cropSetup, isConnected } = useDetection();
  const { bboxes, cropSetup, socket } = useDetection();

  const detectorNodeState = useDetectorNodeStore((s) => s.state);
  const rheedNodeState = useRheedNodeStore((s) => s.state);
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);
  const getFocusedDetection = useLiveAnalysisStore(
    (s) => s.getFocusedDetection
  );

  const svgRef = useRef<SVGSVGElement>(null);

  // useEffect(() => {
  //   console.log("bboxes", bboxes);
  // }, [bboxes]);

  const renderFocusedDetection = useCallback(() => {
    if (!focusedDetectionID) return null;
    const focusedDetection = getFocusedDetection();
    if (!focusedDetection) return null;
    return (
      <MemoizedFocusedDetectionRect
        id={focusedDetection.id}
        detection={focusedDetection}
        cropSetup={cropSetup}
        frameHeight={rheedNodeState.frame_dims[0]}
        frameWidth={rheedNodeState.frame_dims[1]}
      />
    );
  }, [focusedDetectionID, getFocusedDetection, cropSetup, rheedNodeState]);

  const renderDetectionRects = useCallback(() => {
    if (
      !detectorNodeState.is_streaming ||
      !detectorNodeState.is_running ||
      !detectorNodeState.is_available
    ) {
      return null; // Don't render anything if not streaming
    }

    // console.log("detectorNodeState", detectorNodeState);

    return Object.entries(bboxes).map(([id, bbox]) => (
      // <DetectionRect key={id} id={id} detection={bbox} cropSetup={cropSetup} frameHeight={rheedNodeState.frame_dims[0]} frameWidth={rheedNodeState.frame_dims[1]}/>
      <MemoizedDetectionRect
        key={id}
        id={id}
        detection={bbox}
        cropSetup={cropSetup}
        frameHeight={rheedNodeState.frame_dims[0]}
        frameWidth={rheedNodeState.frame_dims[1]}
      />
    ));
  }, [bboxes, cropSetup, detectorNodeState]);

  return (
    <>
      {socket ? null : <Spinner />}
      {/* {isConnected ? null : <Spinner />} */}
      <svg
        ref={svgRef}
        className={styles["svg-detection"]}
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderDetectionRects()}
        {renderFocusedDetection()}
      </svg>
    </>
  );
};

export default Detection;
