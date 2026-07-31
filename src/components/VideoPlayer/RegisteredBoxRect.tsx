import styles from "./VideoPlayer.module.css";
import { getRelativeBbox, correctBbox } from "./utils";

/**
 * A box the RHEED node is integrating, drawn on the video.
 *
 * Distinct from `DetectionRect` (red, what the detector found this frame) and
 * `FocusedDetectionRect` (the one box the analyzer charts): these are the boxes
 * the *node* holds in its registry, whoever registered them. They are drawn
 * dashed and labelled with the bbox id, because that id is the shared name for
 * the box across every client -- it is what another operator would call it.
 *
 * Not gated on the detector node, unlike `DetectionRect`: the integrator's
 * registry has nothing to do with whether object detection is running.
 */
interface RegisteredBoxRectProps {
  id: string;
  /** Corner form `[x1, y1, x2, y2]`, camera-frame pixels. */
  bbox: number[];
  isFocused: boolean;
  isRunningSTFT: boolean;
  cropSetup: { sx: number; sy: number; ex: number; ey: number } | null;
  frameWidth: number;
  frameHeight: number;
  onSelect: (id: string) => void;
}

const RegisteredBoxRect = ({
  id,
  bbox,
  isFocused,
  isRunningSTFT,
  cropSetup,
  frameWidth,
  frameHeight,
  onSelect,
}: RegisteredBoxRectProps) => {
  const { relativeX, relativeY, relativeWidth, relativeHeight } =
    getRelativeBbox(correctBbox(bbox, cropSetup), frameWidth, frameHeight);

  const stroke = isFocused ? "#63b3ed" : isRunningSTFT ? "#9f7aea" : "#48bb78";

  return (
    <g onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
      <rect
        id={`registered-${id}`}
        className={styles["rect-detection"]}
        fill="none"
        stroke={stroke}
        strokeWidth={isFocused ? 2 : 1}
        // Dashes rather than a second solid colour: on a noisy RHEED frame a
        // thin solid line is easy to mistake for a diffraction streak.
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
        x={`${relativeX}%`}
        y={`${relativeY}%`}
        width={`${relativeWidth}%`}
        height={`${relativeHeight}%`}
      />
      <text
        x={`${relativeX}%`}
        y={`${relativeY}%`}
        dy="-4"
        fill={stroke}
        fontSize="11px"
        pointerEvents="none"
        style={{ userSelect: "none" }}
      >
        {id}
      </text>
    </g>
  );
};

export default RegisteredBoxRect;
