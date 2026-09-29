import { ReactNode, useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  SimpleGrid,
  Spinner,
  Switch,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";

import { RheedJpegMeta, RheedSpot } from "../../generated/lumi";
import { useDebounced, useSimPattern } from "../../hooks/useRheedSim";
import useRheedSimStore, { imageRequest, inPlane } from "../../stores/rheedSim";
import useSimulationNodeStore from "../../stores/nodes/simulation";
import SceneControls from "./SceneControls";
import SpotOverlay from "./SpotOverlay";
import { KIND_LABEL } from "./spotKinds";
import SpotLegend from "./SpotLegend";
import SpotTable from "./SpotTable";
import { formatIndex } from "./indices";

const panelStyle = {
  bg: "panel.bg",
  border: "1px solid",
  borderColor: "panel.border",
  borderRadius: "xl",
} as const;

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box>
    <Text fontSize="xs" color="text.secondary">
      {label}
    </Text>
    <Text fontSize="sm" fontFamily="mono">
      {children}
    </Text>
  </Box>
);

const round = (n: number, d = 3) => +n.toFixed(d);

/** What the node actually used: the cut it made, the beam, the lab screen. */
const SceneFacts = ({ meta }: { meta: RheedJpegMeta }) => {
  const { mesh, screen } = meta;
  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
      <Fact label="Surface mesh">
        {round(mesh.a1_length)} × {round(mesh.a2_length)} Å, γ {round(mesh.gamma_deg, 1)}°
      </Fact>
      <Fact label="Mesh vectors a1 / a2">
        {formatIndex(mesh.a1.map((n) => round(n)), "[]")} {formatIndex(mesh.a2.map((n) => round(n)), "[]")}
      </Fact>
      <Fact label="Layer spacing · layers">
        {round(mesh.layer_spacing)} Å · {mesh.n_layers}
      </Fact>
      <Fact label="Termination">
        {mesh.termination}
        {mesh.terminations.length > 1 && (
          <Text as="span" color="text.muted">
            {" "}
            · {mesh.terminations.length} planes per repeat
          </Text>
        )}
      </Fact>
      <Fact label="Beam">
        {meta.energy_kev} keV · λ {round(meta.wavelength_a, 4)} Å
      </Fact>
      <Fact label="k">{round(meta.k_inv_a, 2)} 1/Å</Fact>
      <Fact label="Screen (lab camera)">
        L {screen.camera_length_mm} mm · {screen.pixel_size_mm} mm/px
      </Fact>
      <Fact label="Origin · flips">
        {meta.origin_px.map((n) => round(n, 1)).join(", ")} px
        {screen.flip_x ? " · flip x" : ""}
        {screen.flip_y ? " · flip y" : ""}
      </Fact>
    </SimpleGrid>
  );
};

/** The hovered spot's numbers, pinned beside it on the pattern. */
const SpotTip = ({ spot, width, height }: { spot: RheedSpot; width: number; height: number }) => {
  const left = (spot.x_px / width) * 100;
  const top = (spot.y_px / height) * 100;
  return (
    <Box
      position="absolute"
      left={`${left}%`}
      top={`${top}%`}
      transform={`translate(${left > 60 ? "calc(-100% - 14px)" : "14px"}, -50%)`}
      bg="panel.bgElevated"
      border="1px solid"
      borderColor="panel.border"
      borderRadius="md"
      boxShadow="md"
      px={2.5}
      py={1.5}
      fontSize="xs"
      pointerEvents="none"
      whiteSpace="nowrap"
      zIndex={2}
    >
      <Text fontWeight="600" fontFamily="mono">
        {spot.label}
      </Text>
      <Text color="text.secondary">
        {KIND_LABEL[spot.kind]}
        {spot.laue_zone != null && ` · Laue zone ${spot.laue_zone}`}
      </Text>
      <Text fontFamily="mono">hkl {formatIndex(spot.hkl, "()")}</Text>
      <Text fontFamily="mono">
        ({spot.x_px.toFixed(1)}, {spot.y_px.toFixed(1)}) px · I {spot.intensity.toFixed(3)}
      </Text>
    </Box>
  );
};

/**
 * RHEED patterns computed from a crystal structure: pick the crystal, cut and
 * turn it, set the beam and the surface, and see where every rod and spot
 * lands on the lab camera's screen. The same scene can be drawn over the live
 * camera from here, and over a recorded frame in History.
 *
 * Kinematic and qualitative: positions are what to trust, intensities are a
 * guide (see the backend's docs/RHEED_SIMULATION.md).
 */
const SimulationPage = () => {
  const scene = useRheedSimStore((s) => s.scene);
  const shownKinds = useRheedSimStore((s) => s.shownKinds);
  const showLabels = useRheedSimStore((s) => s.showLabels);
  const overlayOnLive = useRheedSimStore((s) => s.overlayOnLive);
  const setOverlayOnLive = useRheedSimStore((s) => s.setOverlayOnLive);
  const nodeUp = useSimulationNodeStore((s) => s.state.is_available);

  const valid = inPlane(scene.normal, scene.azimuth);
  const request = useDebounced(useMemo(() => (valid ? imageRequest(scene) : null), [scene, valid]));
  const pattern = useSimPattern(request);
  const [hovered, setHovered] = useState<RheedSpot | null>(null);

  const meta = pattern.data?.meta;
  const spots = meta?.spots ?? [];
  const w = meta?.screen.width_px ?? 720;
  const h = meta?.screen.height_px ?? 540;
  // Showing the last good pattern while a new one is computed, or after the new one failed.
  const stale = pattern.isPlaceholderData || pattern.isError || pattern.isFetching;

  return (
    <Flex gap={3} direction={{ base: "column", lg: "row" }} h={{ lg: "calc(100vh - 72px)" }} minH={0}>
      <Box
        {...panelStyle}
        p={4}
        w={{ base: "100%", lg: "340px" }}
        flexShrink={0}
        overflowY={{ lg: "auto" }}
        h={{ lg: "100%" }}
      >
        <SceneControls terminations={meta?.mesh.terminations ?? []} />
      </Box>

      <Box {...panelStyle} flex={1} minW={0} p={4} overflowY={{ lg: "auto" }} h={{ lg: "100%" }}>
        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between" flexWrap="wrap" rowGap={2}>
            <HStack spacing={3} flexWrap="wrap" rowGap={1}>
              <Heading size="md">
                {scene.structure} {formatIndex(scene.normal, "()")}
              </Heading>
              <Text color="text.secondary" fontFamily="mono">
                beam ∥ {formatIndex(scene.azimuth, "[]")}
                {scene.azimuthOffsetDeg !== 0 && ` ${scene.azimuthOffsetDeg > 0 ? "+" : ""}${scene.azimuthOffsetDeg}°`}
              </Text>
              {meta && (
                <Badge variant="subtle" colorScheme="gray" fontWeight="500">
                  {meta.energy_kev} keV · θ {scene.beam.incidence_deg}° · {Math.round(meta.elapsed_ms ?? 0)} ms
                </Badge>
              )}
              {pattern.isFetching && <Spinner size="xs" />}
            </HStack>
            <Tooltip label="Draw this scene's spots over the RHEED camera panel on the dashboard" openDelay={300}>
              <FormControl display="flex" alignItems="center" gap={2} w="auto">
                <Switch
                  id="sim-on-live"
                  size="sm"
                  isChecked={overlayOnLive}
                  onChange={(e) => setOverlayOnLive(e.target.checked)}
                />
                <FormLabel htmlFor="sim-on-live" fontSize="sm" m={0}>
                  Show on live camera
                </FormLabel>
              </FormControl>
            </Tooltip>
          </HStack>

          {!nodeUp ? (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              The simulation node is not running. On the backend it starts with the simulation stack
              once the <code>rheedsim</code> extra is installed.
            </Alert>
          ) : !valid ? (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              The beam azimuth has to lie in the surface plane. Pick one of the directions offered under it.
            </Alert>
          ) : (
            pattern.isError && (
              <Alert status="error" borderRadius="md" alignItems="start">
                <AlertIcon />
                <Text whiteSpace="pre-wrap">{pattern.error.message}</Text>
              </Alert>
            )
          )}

          {meta?.warnings?.map((warning) => (
            <Alert key={warning} status="warning" borderRadius="md" py={2}>
              <AlertIcon />
              <Text fontSize="sm">{warning}</Text>
            </Alert>
          ))}

          <Box maxW="960px" w="100%" alignSelf="center">
            <Box
              position="relative"
              w="100%"
              sx={{ aspectRatio: `${w} / ${h}` }}
              bg="black"
              borderRadius="md"
              overflow="hidden"
            >
              {pattern.data ? (
                <>
                  <img
                    src={pattern.data.url}
                    alt={`Simulated RHEED pattern of ${scene.structure}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: stale ? 0.6 : 1,
                      transition: "opacity 120ms",
                    }}
                  />
                  <SpotOverlay
                    meta={pattern.data.meta}
                    shownKinds={shownKinds}
                    showLabels={showLabels}
                    hovered={hovered}
                    onHover={setHovered}
                  />
                  {hovered && <SpotTip spot={hovered} width={w} height={h} />}
                </>
              ) : (
                nodeUp &&
                valid &&
                !pattern.isError && (
                  <Flex position="absolute" inset={0} align="center" justify="center">
                    <Spinner color="white" />
                  </Flex>
                )
              )}
            </Box>
            {meta && (
              <Box mt={2}>
                <SpotLegend spots={spots} />
                <Text fontSize="xs" color="text.muted" mt={1.5}>
                  Dashed: the shadow edge. Diamond: the specular spot. Cross: the direct beam. Positions are
                  what to trust; kinematic intensities are qualitative.
                </Text>
              </Box>
            )}
          </Box>

          {meta && (
            <>
              <Box>
                <Heading size="xs" mb={2}>
                  Geometry used
                </Heading>
                <SceneFacts meta={meta} />
              </Box>
              <Box>
                <Heading size="xs" mb={2}>
                  Spots ({spots.filter((s) => s.in_view !== false).length} on screen, {spots.length} in all)
                </Heading>
                <SpotTable spots={spots} hovered={hovered} onHover={setHovered} />
              </Box>
            </>
          )}
        </VStack>
      </Box>
    </Flex>
  );
};

export default SimulationPage;
