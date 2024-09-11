import { Grid, GridItem } from "@chakra-ui/react";
import RealTImePressure from "./RealTImePressure";
import RealTImeTemperature from "./RealTImeTemperature";

const RealTimeMonitor = () => {
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap={10}>
      <GridItem>
        <RealTImePressure />
      </GridItem>
      <GridItem>
        <RealTImePressure />
      </GridItem>
      <GridItem>
        <RealTImeTemperature />
      </GridItem>
      <GridItem>
        <RealTImeTemperature />
      </GridItem>
    </Grid>
  );
};

export default RealTimeMonitor;
