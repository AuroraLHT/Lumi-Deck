import { Spinner } from "@chakra-ui/react";
import useRHEED from "../../hooks/useRHEED";
import styles from './VideoPlayer.module.css'

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoPlayer = ({ videoRef }: VideoPlayerProps) => {

  const { isReady } = useRHEED(videoRef);

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

      <video ref={videoRef} id="video" controls={false} autoPlay={true} className={styles['video-player']} width="100%" height="auto">
        Your browser does not support the video tag.
      </video>
    </>
  );
};

export default VideoPlayer;
