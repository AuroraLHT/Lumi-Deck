import useSeriesPalette from "../Plotting/seriesPalette";
import { SPOT_KINDS, SpotKind } from "../../stores/rheedSim";

export const KIND_LABEL: Record<SpotKind, string> = {
  rod: "Rod",
  fractional: "Fractional",
  streak_max: "Streak max",
  bulk: "Bulk",
};

export const KIND_HELP: Record<SpotKind, string> = {
  rod: "An integer-order surface rod meeting the Ewald sphere, on a Laue circle",
  fractional: "A reconstruction's rod meeting the Ewald sphere",
  streak_max: "A bright point along a wide rod's streak, at a bulk Bragg point",
  bulk: "A transmission spot through a 3D island",
};

/** One colour per spot kind, in the palette's fixed order: rod is always series 1. */
export const useKindColors = (): Record<SpotKind, string> => {
  const palette = useSeriesPalette();
  return Object.fromEntries(SPOT_KINDS.map((k, i) => [k, palette[i]])) as Record<SpotKind, string>;
};
