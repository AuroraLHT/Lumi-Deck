import VideoPlayer from "./VideoPlayer";
import Detection from "./Detection";
import styles from "./VideoPlayer.module.css";

import { useState, useRef } from "react";
import {
  Box,
  Switch,
} from "@chakra-ui/react";
import VideoPlayerController from "./VideoPlayerController";

const VideoMain = () => {
  console.log("VideoMain rendered");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showDetections, setShowDetections] = useState(true);


  return (
    <Box>
      <Box className={styles["video-container"]} width="auto" height="auto">
        <VideoPlayer videoRef={videoRef} />
        {showDetections && <Detection />}
      </Box>
      <VideoPlayerController videoRef={videoRef} showDetections={showDetections} setShowDetections={setShowDetections} />
      
    </Box>
  );
};

export default VideoMain;
