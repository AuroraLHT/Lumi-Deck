import { useColorMode } from "@chakra-ui/react";

/**
 * Categorical series colours, assigned in this fixed order and never cycled:
 * series 1 is always blue, series 2 always orange, so a chart that loses a
 * series does not repaint the rest. Validated (dataviz validate_palette.js)
 * against the panel surfaces -- light white, dark ink.850. In light mode the
 * green and yellow sit under 3:1 against white, so a chart using them must
 * carry a legend or labels; every chart here does.
 *
 * A fifth series does not get a generated colour: fold it, or split the chart.
 */
const SERIES_COLORS = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500"],
};

export const MAX_SERIES = SERIES_COLORS.light.length;

const useSeriesPalette = () => {
  const { colorMode } = useColorMode();
  return SERIES_COLORS[colorMode === "dark" ? "dark" : "light"];
};

export default useSeriesPalette;
