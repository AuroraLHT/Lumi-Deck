import { Grid, GridItem } from "@chakra-ui/react";
import RealTimePressure from "./Chamber/RealTimePressure";
import RealTImeTemperature from "./Chamber/RealTImeTemperature";
import RealTImeClassification from "./RealTimeClassification";

const RealTimeMonitor = () => {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
      <GridItem>
        <RealTImeClassification />
      </GridItem>
      <GridItem>
        <RealTimePressure />
      </GridItem>
      <GridItem>
        <RealTImeTemperature />
      </GridItem>
      <GridItem>
        {/* realtime-laser visualization-layer */}
        <RealTImeTemperature />
      </GridItem>
    </Grid>
  );
};

export default RealTimeMonitor;
