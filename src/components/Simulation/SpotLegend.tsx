import { Box, Button, HStack, Switch, FormControl, FormLabel, Tooltip, Wrap } from "@chakra-ui/react";

import { RheedSpot } from "../../generated/lumi";
import useRheedSimStore, { SPOT_KINDS } from "../../stores/rheedSim";
import { KIND_HELP, KIND_LABEL, useKindColors } from "./spotKinds";

/**
 * The legend is the filter: one toggle per spot kind, with its colour and how
 * many there are in view. Shared by the page and the overlays through the
 * store, so hiding bulk spots here hides them on the camera too.
 */
const SpotLegend = ({ spots, compact = false }: { spots: RheedSpot[]; compact?: boolean }) => {
  const shownKinds = useRheedSimStore((s) => s.shownKinds);
  const toggleKind = useRheedSimStore((s) => s.toggleKind);
  const showLabels = useRheedSimStore((s) => s.showLabels);
  const setShowLabels = useRheedSimStore((s) => s.setShowLabels);
  const colors = useKindColors();

  const counts = Object.fromEntries(
    SPOT_KINDS.map((k) => [k, spots.filter((s) => s.kind === k && s.in_view !== false).length])
  );

  return (
    <HStack spacing={3} flexWrap="wrap" rowGap={2} justify="space-between">
      <Wrap spacing={1}>
        {SPOT_KINDS.map((kind) => {
          const on = shownKinds.includes(kind);
          return (
            <Tooltip key={kind} label={KIND_HELP[kind]} openDelay={300}>
              <Button
                size="xs"
                variant="outline"
                aria-pressed={on}
                opacity={on ? 1 : 0.5}
                onClick={() => toggleKind(kind)}
                leftIcon={
                  <Box
                    as="span"
                    boxSize="10px"
                    borderRadius="full"
                    border="2px solid"
                    borderColor={colors[kind]}
                    bg={on ? undefined : "transparent"}
                  />
                }
                color="text.primary"
                fontWeight="500"
              >
                {KIND_LABEL[kind]} {counts[kind]}
              </Button>
            </Tooltip>
          );
        })}
      </Wrap>
      {!compact && (
        <FormControl display="flex" alignItems="center" gap={2} w="auto">
          <Switch id="sim-labels" size="sm" isChecked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          <FormLabel htmlFor="sim-labels" fontSize="xs" m={0}>
            Labels
          </FormLabel>
        </FormControl>
      )}
    </HStack>
  );
};

export default SpotLegend;
