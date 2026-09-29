import { useMemo } from "react";
import { Box, Text, Tooltip } from "@chakra-ui/react";

import { useDebounced, useSimSpots } from "../../hooks/useRheedSim";
import useRheedSimStore, { inPlane, spotsRequest } from "../../stores/rheedSim";
import SpotOverlay from "./SpotOverlay";
import { formatIndex } from "./indices";

/**
 * The current scene's spots over an image of the lab screen: the live camera,
 * or a recorded frame. Positions only -- `rheed_spots`, no rendering -- so it
 * costs tens of milliseconds and never competes with the frames.
 *
 * `energyKev` overrides the scene's beam energy: a recording carries the
 * energy it was taken at, and a pattern indexed at the wrong energy is off by
 * the ratio of the wavevectors.
 *
 * `frame` is the image's own size, [height, width]; the spots are in the
 * simulated screen's pixels, and if the two differ the overlay cannot line up,
 * so it says so rather than draw it stretched.
 */
const SimSpotsLayer = ({ energyKev, frame }: { energyKev?: number | null; frame?: number[] }) => {
  const scene = useRheedSimStore((s) => s.scene);
  const shownKinds = useRheedSimStore((s) => s.shownKinds);
  const showLabels = useRheedSimStore((s) => s.showLabels);

  const valid = inPlane(scene.normal, scene.azimuth);
  const request = useDebounced(
    useMemo(() => (valid ? spotsRequest(scene, energyKev) : null), [scene, energyKev, valid])
  );
  const spots = useSimSpots(request);
  const meta = spots.data;

  const mismatch =
    meta && frame && (frame[0] !== meta.screen.height_px || frame[1] !== meta.screen.width_px)
      ? `The simulated screen is ${meta.screen.width_px}×${meta.screen.height_px} px but this image is ${frame[1]}×${frame[0]}: the spots would not line up.`
      : null;

  const status = !spots.nodeUp
    ? "Simulation node not running"
    : !valid
    ? "Scene azimuth is off the surface plane"
    : spots.isError
    ? spots.error.message
    : mismatch;

  return (
    <>
      {meta && !mismatch && <SpotOverlay meta={meta} shownKinds={shownKinds} showLabels={showLabels} />}
      <Tooltip label={status ?? "Simulated spot positions. Set the scene on the Simulation page."} openDelay={300}>
        <Box
          position="absolute"
          left={2}
          bottom={2}
          px={2}
          py={0.5}
          borderRadius="md"
          bg="blackAlpha.700"
          color={status ? "orange.200" : "white"}
          fontSize="xs"
          fontFamily="mono"
          maxW="calc(100% - 16px)"
          zIndex={2}
        >
          <Text noOfLines={1}>
            {status
              ? `sim: ${status}`
              : `sim: ${scene.structure} ${formatIndex(scene.normal, "()")} ∥${formatIndex(scene.azimuth, "[]")} · ${
                  meta?.energy_kev ?? "…"
                } keV · θ ${scene.beam.incidence_deg}°`}
          </Text>
        </Box>
      </Tooltip>
    </>
  );
};

export default SimSpotsLayer;
