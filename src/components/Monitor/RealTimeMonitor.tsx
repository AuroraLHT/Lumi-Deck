import { Grid, GridItem } from "@chakra-ui/react";
import RealTImePressure from "./Chamber/RealTImePressure";
import RealTImeTemperature from "./Chamber/RealTImeTemperature";
import RealTImeClassification from "./RealTImeClassification";

const RealTimeMonitor = () => {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap={10}>
      <GridItem>
        <RealTImeClassification />
      </GridItem>
      <GridItem>
        <RealTImePressure />
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
