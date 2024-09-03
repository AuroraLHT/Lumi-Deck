import { Spinner } from "@chakra-ui/react";
// import useRHEED from "../../hooks/useRHEED";
import useRHEED from "../../hooks/useRHEEDv2";
import styles from './VideoPlayer.module.css'

const VideoPlayer = () => {
  const { videoRef, isReady } = useRHEED();
  // TODO: add a close button to the video player

  return (
    <>
      {!isReady && (
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="blue.500"
          size="xl"
        />
      )}

      <video ref={videoRef} id="video" controls autoPlay={true} className={styles['video-player']}>
        Your browser does not support the video tag.
      </video>
    </>
  );
};

export default VideoPlayer;
