import VideoPlayer from "./VideoPlayer";
import Detection from "./Detection";
import styles from "./VideoPlayer.module.css";
import CircularButton from "./CircularButton";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Switch,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from "@chakra-ui/react";
import { FaPlay, FaPause, FaStepForward } from "react-icons/fa";

const VideoMain = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDetections, setShowDetections] = useState(true);
  const [lastBufferedTime, setLastBufferedTime] = useState(0);

  const updateProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    let progress = (video.currentTime / video.duration) * 100;
    // Check if progress is NaN and set it to 0 if it is
    if (isNaN(progress)) {
      progress = 0;
    }
    setProgress(progress);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffered = () => {
      if (video.buffered.length > 0) {
        setLastBufferedTime(video.buffered.end(video.buffered.length - 1));
      }
    };

    video.addEventListener("progress", updateBuffered);
    return () => video.removeEventListener("progress", updateBuffered);
  }, [videoRef]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const jumpToLastBuffered = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = lastBufferedTime;
    }
  };

  return (
    <>
      <Box className={styles["video-container"]} width="auto" height="auto">
        <VideoPlayer videoRef={videoRef} togglePlay={togglePlay} />
        {showDetections && <Detection />}
      </Box>

      <Flex bg="rgba(0,0,0,0.7)" p={2} alignItems="center" borderRadius="full">
        <CircularButton
          aria-label={isPlaying ? "Pause" : "Play"}
          icon={isPlaying ? <FaPause /> : <FaPlay />}
          onClick={togglePlay}
          mr={2}
        />
        <Slider
          flex={1}
          value={progress}
          onChange={(value) => {
            if (videoRef.current) {
              videoRef.current.currentTime =
                (value / 100) * videoRef.current.duration;
              updateProgress();
            }
          }}
          mr={2}
        >
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
        <CircularButton
          aria-label="Jump to last buffered"
          icon={<FaStepForward />}
          onClick={jumpToLastBuffered}
        />
      </Flex>

      <Switch
        id="show-detections"
        colorScheme="purple"
        size="sm"
        position="absolute"
        // top="10px"
        // right="10px"
        onChange={(e) => setShowDetections(e.target.checked)}
        isChecked={showDetections}
      >
        Show Detections
      </Switch>
    </>
  );
};

export default VideoMain;
