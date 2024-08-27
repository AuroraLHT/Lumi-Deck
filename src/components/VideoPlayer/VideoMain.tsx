import { Box } from '@chakra-ui/react'
import VideoPlayer from './VideoPlayer'
import Detection from './Detection'
import styles from './VideoPlayer.module.css'

const VideoMain = () => {
  return <Box className={styles['video-container']}>
    <VideoPlayer />
    <Detection />
  </Box>
}

export default VideoMain