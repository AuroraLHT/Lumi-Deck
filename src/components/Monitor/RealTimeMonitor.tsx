import { Grid } from "@chakra-ui/react";
import RealTimePressure from "./Chamber/RealTimePressure";
import RealTimeTemperature from "./Chamber/RealTimeTemperature";
import RealTimeClassification from "./RealTimeClassification";
import RealTimePulseLaser from "./Chamber/RealTimePulseLaser";

/**
 * The four chamber traces.
 *
 * `auto-fit` rather than a fixed `repeat(2, 1fr)`: this panel is 4 of 12 grid
 * columns by default, so a hard 2x2 gave each chart roughly 150px of width --
 * narrower than its own y-axis labels, with every series crushed into a smudge.
 * The track count now follows the *panel's* width, not the viewport's, so the
 * charts stack in one readable column at the default size and only go two-up
 * once someone widens the panel enough for both to clear 280px.
 */
const RealTimeMonitor = () => {
  return (
    <Grid templateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={3}>
      <RealTimePressure />
      <RealTimeTemperature />
      <RealTimePulseLaser />
      <RealTimeClassification />
    </Grid>
  );
};

export default RealTimeMonitor;
