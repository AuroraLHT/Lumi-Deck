import { Grid, GridItem } from "@chakra-ui/react";
import RealTimePressure from "./Chamber/RealTimePressure";
import RealTimeTemperature from "./Chamber/RealTImeTemperature";
import RealTimeClassification from "./RealTimeClassification";
import RealTimePulseLaser from "./Chamber/RealTimePulseLaser";

const RealTimeMonitor = () => {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
      <GridItem>
        <RealTimeClassification />
      </GridItem>
      <GridItem>
        <RealTimePressure />
      </GridItem>
      <GridItem>
        <RealTimeTemperature />
      </GridItem>
      <GridItem>
        <RealTimePulseLaser />
      </GridItem>
    </Grid>
  );
};

export default RealTimeMonitor;
