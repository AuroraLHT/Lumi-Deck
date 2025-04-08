import VideoPlayer from "./VideoPlayer";
import Detection from "./Detection";
import styles from "./VideoPlayer.module.css";

import { useState, useRef } from "react";
import { Box } from "@chakra-ui/react";
import VideoPlayerController from "./VideoPlayerController";
import RectangleSelector from "../Drawing/RectangleSelector";

const VideoMain = () => {
  console.log("VideoMain rendered");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showDetections, setShowDetections] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isManualBox, setIsManualBox] = useState(false);

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
            {isManualBox && <RectangleSelector />}
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
          />
        </Box>
      </Box>
  );
};

export default VideoMain;
