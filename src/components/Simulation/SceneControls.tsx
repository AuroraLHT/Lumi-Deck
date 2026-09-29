import { ReactNode } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Switch,
  Text,
  VStack,
  Wrap,
} from "@chakra-ui/react";
import { LuPlus, LuRotateCcw, LuX } from "react-icons/lu";

import { Reconstruction } from "../../generated/lumi";
import useRheedSimStore, {
  DEFAULT_SCENE,
  Index3,
  IntensityScale,
  LAB_SCENES,
  SimScene,
  inPlane,
} from "../../stores/rheedSim";
import StructurePicker from "./StructurePicker";
import { FieldLabel, IndexField, NumField } from "./fields";
import { formatIndex, inPlaneDirections, sameIndex } from "./indices";

const NORMAL_PRESETS: Index3[] = [
  [0, 0, 1],
  [1, 1, 0],
  [1, 1, 1],
];

const one = (label: string, matrix: number[][]) => ({ label, items: [{ label, matrix }] });
const RECONSTRUCTION_PRESETS: { label: string; items: { label: string; matrix: number[][] }[] }[] = [
  one("2×1", [[2, 0], [0, 1]]),
  one("1×2", [[1, 0], [0, 2]]),
  {
    label: "2×1 + 1×2 (two domains)",
    items: [
      { label: "2×1", matrix: [[2, 0], [0, 1]] },
      { label: "1×2", matrix: [[1, 0], [0, 2]] },
    ],
  },
  one("2×2", [[2, 0], [0, 2]]),
  one("c(2×2)", [[1, 1], [-1, 1]]),
  one("3×3", [[3, 0], [0, 3]]),
  one("(√13×√13)R33.7°", [[3, 2], [-2, 3]]),
];

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box as="section" aria-label={title}>
    <Heading size="xs" textTransform="uppercase" letterSpacing="wider" color="text.secondary" mb={2}>
      {title}
    </Heading>
    <VStack align="stretch" spacing={3}>
      {children}
    </VStack>
  </Box>
);

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <Button
    size="xs"
    variant={active ? "solid" : "outline"}
    colorScheme={active ? "blue" : undefined}
    fontFamily="mono"
    onClick={onClick}
    aria-pressed={active}
  >
    {children}
  </Button>
);

const det = (m: number[][]) => m[0][0] * m[1][1] - m[0][1] * m[1][0];

/** One reconstruction: its 2x2 mesh matrix and how strong its rods are drawn. */
const ReconstructionRow = ({
  value,
  onChange,
  onRemove,
}: {
  value: Reconstruction;
  onChange: (r: Reconstruction) => void;
  onRemove: () => void;
}) => {
  const d = det(value.matrix);
  const setCell = (i: number, j: number, n: number) =>
    onChange({ ...value, matrix: value.matrix.map((row, r) => row.map((c, k) => (r === i && k === j ? n : c))) });

  return (
    <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2}>
      <HStack justify="space-between" mb={1}>
        <Text fontSize="xs" fontWeight="600">
          {value.label ?? "Custom"}
        </Text>
        <IconButton
          aria-label={`Remove the ${value.label ?? "custom"} reconstruction`}
          icon={<Icon as={LuX} />}
          size="xs"
          variant="ghost"
          onClick={onRemove}
        />
      </HStack>
      <HStack align="start" spacing={3}>
        <SimpleGrid columns={2} spacing={1} w="96px" flexShrink={0}>
          {value.matrix.flatMap((row, i) =>
            row.map((c, j) => (
              <NumberInput
                key={`${i}${j}`}
                size="xs"
                value={c}
                step={1}
                min={-8}
                max={8}
                onChange={(_, n) => Number.isInteger(n) && setCell(i, j, n)}
              >
                <NumberInputField aria-label={`Matrix row ${i + 1} column ${j + 1}`} px={2} textAlign="center" />
              </NumberInput>
            ))
          )}
        </SimpleGrid>
        <Box flex={1} minW={0}>
          <NumField
            label="Strength"
            help="Fractional-order rods are the specular rod's profile scaled by this: the positions are right, the intensity is a knob."
            value={value.strength ?? 0.3}
            onChange={(n) => n !== null && onChange({ ...value, strength: n })}
            min={0}
            max={10}
            step={0.05}
            precision={2}
            slider={[0, 1]}
          />
        </Box>
      </HStack>
      {(d === 0 || Math.abs(d) > 64) && (
        <Text fontSize="xs" color="status.error" mt={1}>
          {d === 0 ? "This matrix is singular." : "Larger than 64 surface cells."}
        </Text>
      )}
    </Box>
  );
};

/**
 * The scene: what crystal, cut and turned how, under what beam, with what
 * surface. Every change goes straight to the shared scene store; the page and
 * the overlays send it once it has settled.
 */
const SceneControls = ({ terminations }: { terminations: string[] }) => {
  const scene = useRheedSimStore((s) => s.scene);
  const setScene = useRheedSimStore((s) => s.setScene);
  const resetScene = useRheedSimStore((s) => s.resetScene);

  const set = <K extends keyof SimScene>(key: K) => (value: SimScene[K]) => setScene({ [key]: value });
  const setBeam = (patch: Partial<SimScene["beam"]>) => setScene({ beam: { ...scene.beam, ...patch } });
  const setMorph = (patch: Partial<SimScene["morphology"]>) =>
    setScene({ morphology: { ...scene.morphology, ...patch } });
  const setRender = (patch: Partial<SimScene["render"]>) => setScene({ render: { ...scene.render, ...patch } });

  const directions = inPlaneDirections(scene.normal);
  const azimuthError = inPlane(scene.normal, scene.azimuth)
    ? null
    : `${formatIndex(scene.azimuth, "[]")} does not lie in ${formatIndex(scene.normal, "()")}: h·u + k·v + l·w must be 0.`;

  // A new cut has other planes on top; a termination named for the old one would be refused.
  const setNormal = (normal: Index3) => {
    const azimuth = inPlane(normal, scene.azimuth) ? scene.azimuth : inPlaneDirections(normal, 1)[0] ?? scene.azimuth;
    setScene({ normal, azimuth, termination: null });
  };

  const setReconstructions = set("reconstructions");
  const addPreset = (preset: (typeof RECONSTRUCTION_PRESETS)[number]) =>
    setReconstructions([
      ...scene.reconstructions,
      ...preset.items.map(({ label, matrix }) => ({ matrix, strength: 0.3, label })),
    ]);

  return (
    <VStack align="stretch" spacing={5}>
      <HStack justify="space-between">
        <Heading size="sm">Scene</Heading>
        <Button size="xs" variant="ghost" leftIcon={<Icon as={LuRotateCcw} />} onClick={resetScene}>
          Reset
        </Button>
      </HStack>

      <Section title="Lab frames">
        <Text fontSize="xs" color="text.muted" mt={-1}>
          The scenes the lab screen was fitted to, at 25 keV. Picking one lines the spots up with that frame
          on the camera.
        </Text>
        <Wrap spacing={1}>
          {LAB_SCENES.map(({ key, label, scene: { incidence_deg, ...lab } }) => {
            const active =
              scene.structure === lab.structure &&
              sameIndex(scene.normal, lab.normal!) &&
              sameIndex(scene.azimuth, lab.azimuth!) &&
              scene.beam.incidence_deg === incidence_deg &&
              scene.beam.energy_kev === null &&
              scene.azimuthOffsetDeg === 0;
            return (
              <Chip
                key={key}
                active={active}
                onClick={() =>
                  setScene({
                    ...lab,
                    azimuthOffsetDeg: 0,
                    termination: null,
                    reconstructions: [],
                    beam: { ...DEFAULT_SCENE.beam, incidence_deg },
                  })
                }
              >
                {label}
              </Chip>
            );
          })}
        </Wrap>
      </Section>

      <Section title="Crystal">
        <StructurePicker value={scene.structure} onChange={(structure) => setScene({ structure, termination: null })} />
      </Section>

      <Section title="Surface">
        <IndexField
          label="Surface plane (hkl)"
          help="Miller indices of the surface, in the structure's conventional cell."
          value={scene.normal}
          brackets="()"
          onChange={setNormal}
        >
          <Wrap mt={1.5} spacing={1}>
            {NORMAL_PRESETS.map((n) => (
              <Chip key={n.join()} active={sameIndex(n, scene.normal)} onClick={() => setNormal(n)}>
                {formatIndex(n, "()")}
              </Chip>
            ))}
          </Wrap>
        </IndexField>

        <IndexField
          label="Beam azimuth [uvw]"
          help="The direction the beam travels along the surface: a direct-lattice vector lying in the surface plane."
          value={scene.azimuth}
          brackets="[]"
          onChange={set("azimuth")}
          error={azimuthError}
        >
          <Wrap mt={1.5} spacing={1}>
            {directions.map((d) => (
              <Chip key={d.join()} active={sameIndex(d, scene.azimuth)} onClick={() => set("azimuth")(d)}>
                {formatIndex(d, "[]")}
              </Chip>
            ))}
          </Wrap>
        </IndexField>

        <NumField
          label="Off the zone axis"
          unit="°"
          help="Turns the sample about its normal away from the azimuth: the Laue circles break up as the beam leaves a zone axis."
          value={scene.azimuthOffsetDeg}
          onChange={(n) => n !== null && set("azimuthOffsetDeg")(n)}
          min={-360}
          max={360}
          step={0.1}
          precision={1}
          slider={[-10, 10]}
        />

        <FormControl>
          <FieldLabel label="Termination" help="Which atomic plane is on top: the planes of one repeat of the current cut, top first." />
          <Select
            size="sm"
            value={scene.termination ?? ""}
            onChange={(e) => set("termination")(e.target.value === "" ? null : Number(e.target.value))}
            aria-label="Termination"
          >
            <option value="">Top of the cell (default)</option>
            {terminations.map((t, i) => (
              <option key={i} value={i}>
                {i + 1}. {t}
              </option>
            ))}
            {scene.termination !== null && scene.termination >= terminations.length && (
              <option value={scene.termination}>Plane {scene.termination + 1}</option>
            )}
          </Select>
        </FormControl>

        <Box>
          <HStack justify="space-between" mb={1}>
            <FormLabel fontSize="xs" color="text.secondary" m={0}>
              Reconstructions
            </FormLabel>
            <Menu placement="bottom-end">
              <MenuButton as={Button} size="xs" variant="outline" leftIcon={<Icon as={LuPlus} />} aria-label="Add a reconstruction">
                Add
              </MenuButton>
              <MenuList fontSize="sm">
                {RECONSTRUCTION_PRESETS.map((p) => (
                  <MenuItem key={p.label} onClick={() => addPreset(p)}>
                    {p.label}
                  </MenuItem>
                ))}
                <MenuItem
                  onClick={() =>
                    setReconstructions([...scene.reconstructions, { matrix: [[1, 0], [0, 1]], strength: 0.3, label: null }])
                  }
                >
                  Custom matrix…
                </MenuItem>
              </MenuList>
            </Menu>
          </HStack>
          {scene.reconstructions.length === 0 ? (
            <Text fontSize="xs" color="text.muted">
              None: a bulk-terminated 1×1 surface.
            </Text>
          ) : (
            <VStack align="stretch" spacing={2}>
              {scene.reconstructions.map((r, i) => (
                <ReconstructionRow
                  key={i}
                  value={r}
                  onChange={(next) => setReconstructions(scene.reconstructions.map((x, k) => (k === i ? next : x)))}
                  onRemove={() => setReconstructions(scene.reconstructions.filter((_, k) => k !== i))}
                />
              ))}
            </VStack>
          )}
        </Box>
      </Section>

      <Section title="Beam">
        <NumField
          label="Energy"
          unit="keV"
          help="Empty is the lab's usual energy (rheed.energy_kev in the node's settings)."
          value={scene.beam.energy_kev}
          onChange={(n) => setBeam({ energy_kev: n })}
          nullable
          placeholder="Lab default"
          min={1}
          max={100}
          step={0.5}
        />
        <NumField
          label="Incidence"
          unit="°"
          help="Glancing angle between the beam and the surface plane."
          value={scene.beam.incidence_deg}
          onChange={(n) => n !== null && setBeam({ incidence_deg: n })}
          min={0.01}
          max={20}
          step={0.05}
          precision={2}
          slider={[0.5, 6]}
        />
        <NumField
          label="Divergence"
          unit="mrad"
          help="Angular spread of the beam; blurs every feature."
          value={scene.beam.divergence_mrad}
          onChange={(n) => n !== null && setBeam({ divergence_mrad: n })}
          min={0}
          max={20}
          step={0.1}
          precision={2}
        />
      </Section>

      <Section title="Morphology">
        <NumField
          label="Terrace size"
          unit="nm"
          help="Lateral coherence length. Small terraces widen the rods, which turns spots on a Laue circle into streaks."
          value={scene.morphology.terrace_nm}
          onChange={(n) => n !== null && setMorph({ terrace_nm: n })}
          min={0.5}
          max={100000}
          step={5}
        />
        <NumField
          label="3D islands"
          help="Share of the pattern from 3D islands (transmission spots): 0 is flat, 1 is rough."
          value={scene.morphology.islands}
          onChange={(n) => n !== null && setMorph({ islands: n })}
          min={0}
          max={1}
          step={0.05}
          precision={2}
          slider={[0, 1]}
        />
        <SimpleGrid columns={2} spacing={2}>
          <NumField
            label="Island size"
            unit="nm"
            help="Transmission spots are 2π / this wide."
            value={scene.morphology.island_nm}
            onChange={(n) => n !== null && setMorph({ island_nm: n })}
            min={0.5}
            max={1000}
            step={1}
          />
          <NumField
            label="Mean free path"
            unit="nm"
            help="Inelastic mean free path: how deep the beam sees. About 10 nm in oxides at 10–30 keV."
            value={scene.morphology.mean_free_path_nm}
            onChange={(n) => n !== null && setMorph({ mean_free_path_nm: n })}
            min={0.1}
            max={1000}
            step={1}
          />
        </SimpleGrid>
        <NumField
          label="Debye–Waller B"
          unit="Å²"
          help="For sites that do not carry their own."
          value={scene.morphology.debye_waller_b}
          onChange={(n) => n !== null && setMorph({ debye_waller_b: n })}
          min={0}
          max={50}
          step={0.1}
          precision={2}
        />
      </Section>

      <Section title="Rendering">
        <FormControl>
          <FieldLabel label="Intensity scale" help="RHEED spans decades; sqrt or log show the weak features." />
          <ButtonGroup size="xs" isAttached variant="outline">
            {(["linear", "sqrt", "log"] as IntensityScale[]).map((s) => (
              <Button
                key={s}
                onClick={() => set("scale")(s)}
                aria-pressed={scene.scale === s}
                {...(scene.scale === s ? { variant: "solid", colorScheme: "blue" } : {})}
              >
                {s}
              </Button>
            ))}
          </ButtonGroup>
        </FormControl>
        <SimpleGrid columns={2} spacing={2}>
          <NumField
            label="Blur"
            unit="px"
            help="Point spread of the screen and camera."
            value={scene.render.blur_px}
            onChange={(n) => n !== null && setRender({ blur_px: n })}
            min={0}
            max={50}
            step={0.5}
          />
          <NumField
            label="Background"
            help="Diffuse glow around the specular beam, relative to the strongest feature."
            value={scene.render.background}
            onChange={(n) => n !== null && setRender({ background: n })}
            min={0}
            max={1}
            step={0.01}
            precision={2}
          />
        </SimpleGrid>
        <NumField
          label="Shot noise"
          unit="counts at full scale"
          help="0 is none. Poisson noise with this many counts at the brightest pixel."
          value={scene.render.noise_counts}
          onChange={(n) => n !== null && setRender({ noise_counts: n })}
          min={0}
          max={1e6}
          step={50}
        />
        <FormControl display="flex" alignItems="center" gap={2}>
          <Switch
            id="sim-direct-beam"
            size="sm"
            isChecked={scene.render.direct_beam}
            onChange={(e) => setRender({ direct_beam: e.target.checked })}
          />
          <FormLabel htmlFor="sim-direct-beam" fontSize="xs" m={0}>
            Draw the direct beam under the shadow edge
          </FormLabel>
        </FormControl>
      </Section>
    </VStack>
  );
};

export default SceneControls;
