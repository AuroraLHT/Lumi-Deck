import VideoPlayer from "./VideoPlayer";
import Detection from "./Detection";
import styles from "./VideoPlayer.module.css";

import { useState, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import VideoPlayerController from "./VideoPlayerController";
import RectangleSelector from "../Drawing/RectangleSelector";
import CameraConfigModal from "./CameraConfigModal";
import useLiveAnalysisStore from "../../stores/liveAnalysis";


const VideoMain = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showDetections, setShowDetections] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isManualBox, setIsManualBox] = useState(false);
  const [isCameraConfig, setIsCameraConfig] = useState(false);

  // Set by the analyzer's "redraw" button, which lives in a different panel.
  // Arming the overlay from here saves the user having to also find the
  // manual-box button over on the video before their drag does anything.
  const redrawTargetID = useLiveAnalysisStore((s) => s.redrawTargetID);
  const isSelecting = isManualBox || redrawTargetID !== null;


  return (
      <Box 
        position="relative"
      >
        {isFocused && (
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(0, 0, 0, 0.7)"
            backdropFilter="blur(5px)"
            zIndex={1}
          />
        )}
        <Box 
          className={styles["video-container"]} 
          width={isFocused ? '50vw' : 'auto'} 
          height="auto"
          position="relative"
          zIndex={isFocused ? 2 : 0}
          margin={isFocused ? '0 auto' : undefined}
        >
          <Box width="100%" height="100%" position="relative">
            <VideoPlayer videoRef={videoRef} />
            {showDetections && <Detection />}
            {isSelecting && <RectangleSelector />}

            {redrawTargetID !== null && (
              <Text
                position="absolute"
                top={2}
                left="50%"
                transform="translateX(-50%)"
                px={3}
                py={1}
                borderRadius="full"
                bg="blackAlpha.700"
                color="white"
                fontSize="xs"
                fontWeight="600"
                pointerEvents="none"
                zIndex={3}
                whiteSpace="nowrap"
              >
                {`Drag to redraw box ${redrawTargetID} — Esc to cancel`}
              </Text>
            )}
          </Box>

          <VideoPlayerController 
            videoRef={videoRef} 
            showDetections={showDetections} 
            setShowDetections={setShowDetections}
            setIsFocused={setIsFocused}  // Pass this to your controller
            isFocused={isFocused}            // Pass this to your controller
            zIndex={isFocused ? 3 : 0}
            isManualBox={isManualBox}
            setIsManualBox={setIsManualBox}
            isCameraConfig={isCameraConfig}
            setIsCameraConfig={setIsCameraConfig}
          />
        </Box>

        <CameraConfigModal 
          isCameraConfig={isCameraConfig} 
          setIsCameraConfig={setIsCameraConfig} 
        />
      </Box>
  );
};

export default VideoMain;
