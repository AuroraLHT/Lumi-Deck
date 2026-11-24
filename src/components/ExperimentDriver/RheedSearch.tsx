import { Badge, Box, Button, HStack, Icon, Text, VStack } from "@chakra-ui/react";
import { LuZap } from "react-icons/lu";

import { RheedSearch } from "../../generated/lumi";
import useDriverCall from "../../hooks/useDriverCall";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import ConfirmButton from "../Controller/ConfirmButton";

type Call = ReturnType<typeof useDriverCall>;

/** The filament goes up this much per Up (Lumi's `filament_step_ma`). */
const STEP_MA = 50;

interface Step {
  filamentMa: number;
  emissionUa: number | null;
  /** The brightest pixels less the background: what the search compares. */
  rheedSignal: number | null;
  rheedBackground: number | null;
  /** Frame-to-frame spread over the signal; a change under about twice this is not a change. */
  rheedNoise: number | null;
  rheedP999: number | null;
  /** The image's peak over full scale (1 = at full scale). */
  rheedHeadroom: number | null;
  /** Pixels at full scale per frame. */
  rheedClippedPx: number | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** `RheedSearch.steps` is untyped in the contract: read each field defensively. */
const readSteps = (search: RheedSearch): Step[] =>
  (search.steps ?? []).flatMap((s) => {
    const filamentMa = num(s.filament_ma);
    if (filamentMa == null) return [];
    return [
      {
        filamentMa,
        emissionUa: num(s.emission_ua),
        rheedSignal: num(s.rheed_signal),
        rheedBackground: num(s.rheed_background),
        rheedNoise: num(s.rheed_noise),
        rheedP999: num(s.rheed_p999),
        rheedHeadroom: num(s.rheed_headroom),
        rheedClippedPx: num(s.rheed_clipped_px),
      },
    ];
  });

/** Everything about the step's image the signal column leaves out. */
const describeImage = (step: Step) =>
  [
    step.rheedBackground != null ? `background ${step.rheedBackground.toFixed(1)}` : null,
    step.rheedNoise != null ? `noise ${(step.rheedNoise * 100).toFixed(1)}%` : null,
    step.rheedP999 != null ? `p99.9 ${step.rheedP999.toFixed(1)}` : null,
    step.rheedHeadroom != null ? `peak at ${Math.round(step.rheedHeadroom * 100)}% of full scale` : null,
  ]
    .filter(Boolean)
    .join(" · ") || undefined;

const JUDGE_LABEL: Record<string, string> = {
  agent: "the agent decides",
  person: "you decide",
  rule: "the first-two-digits rule decides",
};

/**
 * The step table and the controls for RHEED gun on's open emission search,
 * read live from the driver's `rheed_search` (every step, under any judge).
 *
 * - Stop here ends the search at that step (going back down to it if it was
 *   earlier), then sets focus and deflection. Offered for the agent and the
 *   person; under the rule, rheed_on itself is stepping and stopping.
 * - Up raises the filament one step; only for a person, since the agent
 *   steps on its own.
 * - Abort (RHEED off) ramps HV and the filament off and ends the search.
 */
export const RheedSearchControls = ({ search, call }: { search: RheedSearch; call: Call }) => {
  const steps = readSteps(search);
  const last = steps.length - 1;
  const showSignal = steps.some((s) => s.rheedSignal != null);
  const canStop = search.judge !== "rule";
  const atMax = last >= 0 && search.filament_max_ma != null && steps[last].filamentMa + STEP_MA > search.filament_max_ma;

  return (
    <VStack align="stretch" spacing={2}>
      {search.saturation && <Text fontSize="xs">{search.saturation}</Text>}
      {steps.length > 0 && (
        <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" px={2} py={1}>
          <HStack fontSize="xs" color="text.muted" spacing={2}>
            <Text w="72px">Filament mA</Text>
            <Text w="76px">Emission µA</Text>
            {showSignal && <Text w="76px">RHEED signal</Text>}
          </HStack>
          {steps.map((step, i) => (
            <HStack
              key={step.filamentMa}
              fontSize="xs"
              spacing={2}
              minH="24px"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              <Text w="72px">{step.filamentMa}</Text>
              <Text w="76px">{step.emissionUa == null ? "—" : step.emissionUa.toPrecision(4)}</Text>
              {showSignal && (
                <HStack w="76px" spacing={1} title={describeImage(step)}>
                  <Text>{step.rheedSignal == null ? "—" : step.rheedSignal.toFixed(1)}</Text>
                  {(step.rheedClippedPx ?? 0) > 0 && (
                    <Badge colorScheme="orange" variant="subtle" fontSize="0.6rem" title={`${step.rheedClippedPx} pixels at full scale per frame`}>
                      clipped
                    </Badge>
                  )}
                </HStack>
              )}
              {canStop && (
                <Button
                  size="xs"
                  ml="auto"
                  variant={i === last ? "solid" : "outline"}
                  colorScheme="green"
                  isLoading={call.busy}
                  isDisabled={!call.canOperate}
                  title={
                    i === last
                      ? "End the search here, then set focus and deflection."
                      : `Take the filament back to ${step.filamentMa} mA, end the search there, then set focus and deflection.`
                  }
                  onClick={() => call.run((c) => c.finish_rheed_on({ filament_ma: step.filamentMa }))}
                >
                  Stop here
                </Button>
              )}
            </HStack>
          ))}
        </Box>
      )}
      <HStack spacing={2} flexWrap="wrap" rowGap={2}>
        {search.judge === "person" && (
          <Button
            size="xs"
            colorScheme="blue"
            isLoading={call.busy}
            isDisabled={!call.canOperate || atMax}
            title={
              atMax
                ? `The filament is at its maximum (${search.filament_max_ma} mA): stop here or at an earlier step.`
                : `Raise the filament one step (${STEP_MA} mA) and read the emission after it settles.`
            }
            onClick={() => call.run((c) => c.rheed_emission_step_up())}
          >
            Up {STEP_MA} mA
          </Button>
        )}
        <ConfirmButton
          size="xs"
          variant="ghost"
          colorScheme="red"
          isDisabled={!call.canOperate || call.busy}
          confirmLabel="Ramp HV and the filament off and end the search? About two minutes from full."
          onConfirm={() => call.run((c) => c.rheed_off()).then(() => undefined)}
        >
          Abort: RHEED off
        </ConfirmButton>
      </HStack>
      {call.error && (
        <Text fontSize="xs" color="status.error">
          {call.error}
        </Text>
      )}
    </VStack>
  );
};

/**
 * An open emission search with no prompt for a person: the agent's (or the
 * rule's) search, shown so the operator can see it and stop or abort it.
 * A person's search shows in the `rheed_emission` prompt instead.
 */
const RheedSearchCard = () => {
  const search = useExperimentDriverNodeStore((s) => s.state.rheed_search);
  const gated = useExperimentDriverNodeStore((s) => s.state.pending_confirmation?.kind === "rheed_emission");
  const call = useDriverCall();
  if (!search || gated) return null;
  return (
    <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2} aria-label="RHEED emission search">
      <VStack align="stretch" spacing={2}>
        <HStack spacing={1}>
          <Icon as={LuZap} color="status.warn" />
          <Text fontSize="xs" fontWeight="600">
            RHEED emission search
          </Text>
          <Text fontSize="xs" color="text.muted">
            · {JUDGE_LABEL[search.judge] ?? search.judge}
          </Text>
        </HStack>
        <RheedSearchControls search={search} call={call} />
      </VStack>
    </Box>
  );
};

export default RheedSearchCard;
