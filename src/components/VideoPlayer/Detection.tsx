import DetectionRect from "./DetectionRect";
import FocusedDetectionRect from "./FocusedDetectionRect";
import RegisteredBoxRect from "./RegisteredBoxRect";

import { Spinner } from "@chakra-ui/react";

import useDetectorNodeStore from "../../stores/nodes/detector";
import useRheedNodeStore from "../../stores/nodes/rheed";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import useDetection from "../../hooks/useDetection";
import useRegisteredBoxes from "../../hooks/useRegisteredBoxes";

import styles from "./VideoPlayer.module.css";

import { useCallback, useRef } from "react";
import React from "react";

// Memoize the DetectionRect component
const MemoizedDetectionRect = React.memo(DetectionRect);
const MemoizedFocusedDetectionRect = React.memo(FocusedDetectionRect);
const MemoizedRegisteredBoxRect = React.memo(RegisteredBoxRect);

const Detection = () => {
  const { bboxes, cropSetup, isConnected } = useDetection();

  const detectorNodeState = useDetectorNodeStore((s) => s.state);
  const rheedNodeState = useRheedNodeStore((s) => s.state);
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);
  const getFocusedDetection = useLiveAnalysisStore(
    (s) => s.getFocusedDetection
  );
  const setFocusedDetectionID = useLiveAnalysisStore(
    (s) => s.setFocusedDetectionID
  );
  const { boxes: registeredBoxes } = useRegisteredBoxes();

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

  // Every box the node is integrating, whoever registered it -- so a box created
  // in another client, or before this page was last reloaded, is visible here
  // rather than only in the analyzer list.
  const renderRegisteredBoxes = useCallback(
    () =>
      registeredBoxes.map((box) => (
        <MemoizedRegisteredBoxRect
          key={box.id}
          id={box.id}
          bbox={box.corners}
          isFocused={box.id === focusedDetectionID}
          isRunningSTFT={box.isRunningSTFT}
          cropSetup={cropSetup}
          frameHeight={rheedNodeState.frame_dims[0]}
          frameWidth={rheedNodeState.frame_dims[1]}
          onSelect={setFocusedDetectionID}
        />
      )),
    [
      registeredBoxes,
      focusedDetectionID,
      cropSetup,
      rheedNodeState,
      setFocusedDetectionID,
    ]
  );

  return (
    <>
      {isConnected ? null : <Spinner />}
      <svg
        ref={svgRef}
        className={styles["svg-detection"]}
        xmlns="http://www.w3.org/2000/svg"
      >
        {renderDetectionRects()}
        {renderRegisteredBoxes()}
        {renderFocusedDetection()}
      </svg>
    </>
  );
};

export default Detection;
