import { Grid, GridItem } from "@chakra-ui/react";
import RealTImePressure from "./RealTImePressure";
import RealTImeTemperature from "./RealTImeTemperature";
import useLog from "../../hooks/useChamberLog";

const RealTimeMonitor = () => {
  const { logs, recentLog } = useLog();
  return (
    <Grid templateColumns="repeat(2, 1fr)" gap={10}>
      <GridItem>
        <RealTImePressure logs={logs} recentLog={recentLog} />
      </GridItem>
      <GridItem>
        <RealTImePressure logs={logs} recentLog={recentLog} />
      </GridItem>
      <GridItem>
        <RealTImeTemperature logs={logs} recentLog={recentLog} />
      </GridItem>
      <GridItem>
        <RealTImeTemperature logs={logs} recentLog={recentLog} />
      </GridItem>
    </Grid>
  );
};

export default RealTimeMonitor;
