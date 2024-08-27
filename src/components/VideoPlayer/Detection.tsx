import { useRef } from "react";
import DetectionRect from "./DetectionRect";
import useDetection from "../../hooks/useDetection";
import { Spinner } from "@chakra-ui/react";
import styles from "./VideoPlayer.module.css";

const Detection = () => {
  const { bboxes, cropSetup, isConnected } = useDetection();

  const svgRef = useRef<SVGSVGElement>(null);

  // useEffect(() => {
  //   console.log("bboxes", bboxes);
  // }, [bboxes]);

  return (
    <>
      {isConnected ? null : <Spinner />}
      <svg ref={svgRef} className={styles['svg-detection']} xmlns="http://www.w3.org/2000/svg">
        {Object.entries(bboxes).map(([id, bbox]) => (
          <DetectionRect key={id} id={id} bbox={bbox.bbox} cropSetup={cropSetup} />
        ))}
      </svg>
    </>
  );
};

export default Detection;
