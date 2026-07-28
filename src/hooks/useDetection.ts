import useDetectionStore from "../stores/detection";
import useTransportStore from "../clients/transport";

/**
 * Reads the latest detections for the video overlay. The boxes are put there by
 * `useDetectionStream`, which owns the single `detection.overlay` subscription
 * over the shared transport.
 */
const useDetection = () => {
  const bboxes = useDetectionStore((s) => s.bboxes);
  const cropSetup = useDetectionStore((s) => s.cropSetup);
  // Replaces the old raw `socket` object the overlay used as a readiness flag.
  const isConnected = useTransportStore((s) => s.status === "open");
  return { bboxes, cropSetup, isConnected };
};

export default useDetection;
