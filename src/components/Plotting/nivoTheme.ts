import { useColorMode } from "@chakra-ui/react";
import { useMemo } from "react";

/**
 * Nivo draws to a canvas, so it cannot read the Chakra semantic tokens the rest
 * of the UI uses -- it needs literal colours. These mirror `plot.*` in theme.ts.
 * Keep the two in step.
 */
const useNivoTheme = () => {
  const { colorMode } = useColorMode();

  return useMemo(() => {
    const isDark = colorMode === "dark";

    const axis = isDark ? "#7f8da0" : "#5c6b7f";
    const grid = isDark ? "#2a3441" : "#d4dbe3";
    const text = isDark ? "#aeb9c7" : "#425061";
    const tooltipBg = isDark ? "#1a222c" : "#ffffff";

    return {
      background: "transparent",
      text: { fill: text, fontSize: 11 },
      axis: {
        domain: { line: { stroke: grid, strokeWidth: 1 } },
        ticks: {
          line: { stroke: grid, strokeWidth: 1 },
          text: { fill: axis, fontSize: 10 },
        },
        legend: { text: { fill: text, fontSize: 11, fontWeight: 600 } },
      },
      grid: { line: { stroke: grid, strokeWidth: 1 } },
      legends: { text: { fill: text, fontSize: 11 } },
      tooltip: {
        container: {
          background: tooltipBg,
          color: text,
          fontSize: 12,
          borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        },
      },
      crosshair: { line: { stroke: axis, strokeWidth: 1, strokeOpacity: 0.6 } },
    };
  }, [colorMode]);
};

export default useNivoTheme;
