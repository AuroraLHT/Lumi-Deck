import { CSSProperties, RefObject, useRef } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { LuCamera, LuImagePlus } from "react-icons/lu";

import useRheedVideo from "../../hooks/useRheedVideo";
import useRheedSimStore, { CompareMode, CompareSource, Snapshot } from "../../stores/rheedSim";
import useRheedNodeStore from "../../stores/nodes/rheed";

const fill: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
};

/** How the real image sits over the simulated one. */
const modeStyle = (mode: CompareMode, amount: number): CSSProperties =>
  mode === "blend"
    ? { opacity: amount }
    : mode === "split"
    ? { clipPath: `inset(0 ${(1 - amount) * 100}% 0 0)` }
    : { mixBlendMode: "difference" };

/** The live feed, mounted only while it is being compared: one more subscriber to the stream. */
const LiveVideo = ({ videoRef, style }: { videoRef: RefObject<HTMLVideoElement>; style: CSSProperties }) => {
  useRheedVideo(videoRef);
  return <video ref={videoRef} autoPlay muted playsInline style={{ ...fill, objectFit: "fill", ...style }} />;
};

const Caption = ({ text, warn }: { text: string; warn?: boolean }) => (
  <Box
    position="absolute"
    left={2}
    top={2}
    px={2}
    py={0.5}
    borderRadius="md"
    bg="blackAlpha.700"
    color={warn ? "orange.200" : "white"}
    fontSize="xs"
    fontFamily="mono"
    maxW="calc(100% - 16px)"
    pointerEvents="none"
    zIndex={1}
  >
    <Text noOfLines={2}>{text}</Text>
  </Box>
);

/**
 * A real RHEED image laid over the simulated pattern, under the spot rings:
 * the live camera or a still. Both are stretched over the simulated screen,
 * so they line up only when they are the same size -- the caption says when
 * they are not.
 */
export const CompareLayer = ({
  videoRef,
  width,
  height,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  /** The simulated screen, px. */
  width: number;
  height: number;
}) => {
  const source = useRheedSimStore((s) => s.compareSource);
  const mode = useRheedSimStore((s) => s.compareMode);
  const amount = useRheedSimStore((s) => s.compareAmount);
  const snapshot = useRheedSimStore((s) => s.snapshot);
  const cameraUp = useRheedNodeStore((s) => s.state.is_available);
  const [frameH, frameW] = useRheedNodeStore((s) => s.state.frame_dims);

  if (source === "off") return null;
  if (source === "live" && !cameraUp) return <Caption text="live: the RHEED camera is not running" warn />;
  if (source === "snapshot" && !snapshot) return null;

  const [imgW, imgH] = source === "live" ? [frameW, frameH] : [snapshot!.width, snapshot!.height];
  const mismatch = imgW !== width || imgH !== height;
  const name = source === "live" ? "live" : `snapshot: ${snapshot!.label}`;
  const style = modeStyle(mode, amount);

  return (
    <>
      {source === "live" ? (
        <LiveVideo videoRef={videoRef} style={style} />
      ) : (
        <img src={snapshot!.url} alt={`RHEED ${name}`} style={{ ...fill, ...style }} />
      )}
      {mode === "split" && (
        <Box
          position="absolute"
          top={0}
          bottom={0}
          left={`${amount * 100}%`}
          w="2px"
          ml="-1px"
          bg="whiteAlpha.800"
          pointerEvents="none"
        />
      )}
      <Caption
        text={mismatch ? `${name}: ${imgW}×${imgH} px, stretched over the ${width}×${height} screen` : name}
        warn={mismatch}
      />
    </>
  );
};

/** Grab what the video shows right now, at its own resolution. */
const captureVideo = (video: HTMLVideoElement): Promise<Snapshot> =>
  new Promise((resolve, reject) => {
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) return reject(new Error("No frame yet"));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Could not encode the frame"));
      resolve({ url: URL.createObjectURL(blob), width, height, label: `live ${new Date().toLocaleTimeString()}` });
    }, "image/png");
  });

const loadImage = (file: File): Promise<Snapshot> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight, label: file.name });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} is not an image the browser can read`));
    };
    img.src = url;
  });

const SOURCES: { key: CompareSource; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "live", label: "Live camera" },
  { key: "snapshot", label: "Snapshot" },
];

const MODES: { key: CompareMode; label: string; help: string }[] = [
  { key: "blend", label: "Blend", help: "The real image over the simulated one, faded by the slider" },
  { key: "split", label: "Split", help: "Real on the left of the line, simulated on the right" },
  { key: "difference", label: "Difference", help: "Bright where the two disagree, dark where they match" },
];

/** Which real image to compare against, and how to lay it over the pattern. */
export const CompareControls = ({ videoRef }: { videoRef: RefObject<HTMLVideoElement> }) => {
  const source = useRheedSimStore((s) => s.compareSource);
  const mode = useRheedSimStore((s) => s.compareMode);
  const amount = useRheedSimStore((s) => s.compareAmount);
  const snapshot = useRheedSimStore((s) => s.snapshot);
  const setCompare = useRheedSimStore((s) => s.setCompare);
  const setSnapshot = useRheedSimStore((s) => s.setSnapshot);
  const cameraUp = useRheedNodeStore((s) => s.state.is_available);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const adopt = (next: Promise<Snapshot>) =>
    next.then(
      (snap) => {
        setSnapshot(snap);
        setCompare({ compareSource: "snapshot" });
      },
      (err: Error) => toast({ status: "error", title: err.message, duration: 4000 })
    );

  return (
    <HStack spacing={3} flexWrap="wrap" rowGap={2}>
      <Text fontSize="xs" color="text.secondary">
        Compare with
      </Text>
      <ButtonGroup size="xs" variant="outline" isAttached>
        {SOURCES.map(({ key, label }) => (
          <Button
            key={key}
            aria-pressed={source === key}
            {...(source === key ? { variant: "solid", colorScheme: "blue" } : {})}
            isDisabled={key === "snapshot" && !snapshot}
            title={key === "snapshot" && !snapshot ? "Take one from the live camera, or open an image" : undefined}
            onClick={() => setCompare({ compareSource: key })}
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>

      <Tooltip label="Freeze the live frame to compare against while you tune the scene" openDelay={300}>
        <Button
          size="xs"
          variant="ghost"
          leftIcon={<LuCamera />}
          isDisabled={source !== "live" || !cameraUp}
          onClick={() => videoRef.current && adopt(captureVideo(videoRef.current))}
        >
          Take snapshot
        </Button>
      </Tooltip>
      <Button size="xs" variant="ghost" leftIcon={<LuImagePlus />} onClick={() => fileRef.current?.click()}>
        Open image…
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        aria-label="Open a RHEED image"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) adopt(loadImage(file));
        }}
      />

      {source !== "off" && (
        <HStack spacing={3} flexWrap="wrap" rowGap={2}>
          <ButtonGroup size="xs" variant="outline" isAttached>
            {MODES.map(({ key, label, help }) => (
              <Tooltip key={key} label={help} openDelay={300}>
                <Button
                  aria-pressed={mode === key}
                  {...(mode === key ? { variant: "solid", colorScheme: "blue" } : {})}
                  onClick={() => setCompare({ compareMode: key })}
                >
                  {label}
                </Button>
              </Tooltip>
            ))}
          </ButtonGroup>
          {mode !== "difference" && (
            <Slider
              aria-label={mode === "blend" ? "Real image opacity" : "Split position"}
              w="140px"
              size="sm"
              min={0}
              max={1}
              step={0.01}
              value={amount}
              onChange={(v) => setCompare({ compareAmount: v })}
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          )}
        </HStack>
      )}
    </HStack>
  );
};
