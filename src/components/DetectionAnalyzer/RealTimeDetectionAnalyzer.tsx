// import React from 'react'
import { Box, Grid, GridItem, Heading } from "@chakra-ui/react";
import DetectionAnalyzerSidebar from "./DetectionAnalyzerSidebar";
import DetectionAnalyzerMain from "./DetectionAnalyzerMain";

const RealTimeDetectionAnalyzer = () => {
  return (
    <Box width="100%" height="100%">
      <Heading>RealTimeDetectionAnalyzer</Heading>
      <Grid
        templateAreas={`"sidebar main"`}
        gridTemplateColumns="2fr 5fr"
        gridTemplateRows="1fr"
        h = {"20rem"}
        gap={4}        
      >
        <GridItem area="sidebar">
        {/* <GridItem area="sidebar">1 */}
          <DetectionAnalyzerSidebar />
        </GridItem>
        <GridItem area="main">
          <DetectionAnalyzerMain />
        </GridItem>
      </Grid>
    </Box>
  )
}

export default RealTimeDetectionAnalyzer