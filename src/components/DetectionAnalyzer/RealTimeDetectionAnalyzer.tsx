import { Box, Grid, GridItem } from "@chakra-ui/react";
import DetectionAnalyzerSidebar from "./DetectionAnalyzerSidebar";
import DetectionAnalyzerMain from "./DetectionAnalyzerMain";

/**
 * Box list on the left, the focused box's controls and traces on the right.
 *
 * The rail is a fixed width rather than a fraction: it holds a number, two
 * status dots and a close button, all of which have the same size whatever the
 * panel is, and `1fr 5fr` was sizing it out of existence in a narrow panel. The
 * grid no longer pins itself to 20rem either -- the dashboard panel body is the
 * thing that scrolls, so a fixed height here just clipped the STFT chart.
 */
const RealTimeDetectionAnalyzer = () => {
  return (
    <Box width="100%" height="100%">
      <Grid
        templateAreas={`"sidebar main"`}
        gridTemplateColumns="76px minmax(0, 1fr)"
        gap={2}
      >
        <GridItem area="sidebar" minW={0}>
          <DetectionAnalyzerSidebar />
        </GridItem>
        <GridItem area="main" minW={0}>
          <DetectionAnalyzerMain />
        </GridItem>
      </Grid>
    </Box>
  );
};

export default RealTimeDetectionAnalyzer;
