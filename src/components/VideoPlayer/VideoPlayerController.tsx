import {
  Flex,
  // Slider,
  // SliderFilledTrack,
  // SliderThumb,
  // SliderTrack,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import CircularButton from "./CircularButton";
import { FaPause, FaPlay, FaStepForward } from "react-icons/fa";
import { RiCheckboxMultipleBlankLine } from "react-icons/ri";
import { RiEditBoxLine } from "react-icons/ri";

import { GoScreenFull } from "react-icons/go";
import { GoScreenNormal } from "react-icons/go";
import { IoIosSettings } from "react-icons/io";

interface VideoPlayerControllerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  showDetections: boolean;
  isFocused: boolean;
  isManualBox: boolean;
  setShowDetections: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>;
  setIsManualBox: React.Dispatch<React.SetStateAction<boolean>>;
  isCameraConfig: boolean;
  setIsCameraConfig: React.Dispatch<React.SetStateAction<boolean>>;
  zIndex: number;
}

const VideoPlayerController = ({
  videoRef,
  showDetections,
  setShowDetections,
  isFocused,
  setIsFocused,
  isManualBox,
  setIsManualBox,
  zIndex,
  isCameraConfig,
  setIsCameraConfig,
}: VideoPlayerControllerProps) => {
  // console.log("VideoPlayerController rendered");
  const [isPlaying, setIsPlaying] = useState(false);
  //   const [progress, setProgress] = useState(0);
  //   const [lastBufferedTime, setLastBufferedTime] = useState(0);
  const progressRef = useRef(0); // Use ref for progress
  const lastBufferedTimeRef = useRef(0); // Use ref for lastBufferedTime
  const sliderRef = useRef<HTMLInputElement>(null);

  const updateProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    let progress = (video.currentTime / video.duration) * 100;
    // Check if progress is NaN and set it to 0 if it is
    if (isNaN(progress)) {
      progress = 0;
    }
    // setProgress(progress);
    progressRef.current = progress; // Update ref
    // console.log("Updating progress value:", progress);
    if (sliderRef.current) {
      //   sliderRef.current.value = Math.round(progress).toString();
      console.log("Slider value:", sliderRef.current.value);
    }
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
    if (videoRef.current && lastBufferedTimeRef.current) {
      videoRef.current.currentTime = lastBufferedTimeRef.current;
      updateProgress();
    }
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
        // setLastBufferedTime(video.buffered.end(video.buffered.length - 1));
        lastBufferedTimeRef.current = video.buffered.end(
          video.buffered.length - 1
        );
      }
    };

    video.addEventListener("progress", updateBuffered);
    return () => video.removeEventListener("progress", updateBuffered);
  }, [videoRef]);

  // slider is rendered in a very high frequency, which causes performance issues
  // it is disable now. we can try throttling or debouncing the updateProgress function

  return (
    <Flex
      bg="gray.600"
      p={2}
      alignItems="center"
      justifyContent="center"
      borderRadius="full"
      gap={2}
      zIndex={zIndex}
    >
      <CircularButton
        aria-label={isPlaying ? "Pause" : "Play"}
        icon={isPlaying ? <FaPause /> : <FaPlay />}
        onClick={togglePlay}
      />

      {/* <Slider
        flex={1}
        ref={sliderRef}
        value={progressRef.current}
        min={0}
        max={100}
        onChange={(value) => {
          console.log("onChange, Slider value:", value);
          if (videoRef.current) {
            videoRef.current.currentTime =
              (value / 100) * videoRef.current.duration;
            console.log("Updating progress value:", videoRef.current.currentTime);

            updateProgress();
          }
        }}
        mr={2}
      >
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb />
      </Slider> */}

      <CircularButton
        aria-label="Jump to last buffered"
        icon={<FaStepForward />}
        onClick={jumpToLastBuffered}
      />

      <CircularButton
        aria-label="Focus"
        icon={isFocused ? <GoScreenNormal size={20} /> : <GoScreenFull size={20} />}
        onClick={() => setIsFocused(!isFocused)}
      />

      <CircularButton
        aria-label="Select multiple"
        icon={<RiCheckboxMultipleBlankLine />}
        onClick={() => {
          // console.log("Select multiple");
          setShowDetections(!showDetections);
        }}
        {...(showDetections ? { colorScheme: "red" } : {})}
        // color={showDetections ? "current" : "white"}
      />

      <CircularButton
        aria-label="Manual box"
        icon={<RiEditBoxLine />}
        onClick={() => {
          // console.log("Select multiple");
          setIsManualBox(!isManualBox);
        }}
        {...(isManualBox ? { colorScheme: "red" } : {})}
      />

      <CircularButton
        aria-label="Camera Config"
        icon={<IoIosSettings size={20} />}
        onClick={() => {
          // console.log("Select multiple");
          setIsCameraConfig(!isCameraConfig);
        }}
        {...(isCameraConfig ? { colorScheme: "red" } : {})}
      />

    </Flex>
  );
};

export default VideoPlayerController;
