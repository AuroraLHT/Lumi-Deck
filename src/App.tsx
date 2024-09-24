// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import  DemoComponent  from "./components/Demo"
import VideoMain from "./components/VideoPlayer/VideoMain";
// import HostSelector from "./components/HostSelector";
import MainController from "./components/MainController";
import MainWebsocketsProvider from "./components/MainWebSockets";
import Navbar from "./navbar";
import { Box, Grid, GridItem } from "@chakra-ui/react";
import RealTimeMonitor from "./components/Monitor/RealTimeMonitor";
import RealTimeDetectionAnalyzer from "./components/DetectionAnalyzer/RealTimeDetectionAnalyzer";
// import MainControllerSimulator from "./components/MainControlSimulator"
// import './App.css'

function App() {
  return (
    <>
      <Navbar></Navbar>

      <Box padding={4}>
        <MainWebsocketsProvider>
          <Grid
            templateRows="4fr 2fr 6fr"
            templateColumns="4fr 4fr 6fr"
            templateAreas={`
                "video ai vis"
                "controller other other"
              `}
            gap={2}
          >
            <GridItem area="video">
              <VideoMain></VideoMain>
            </GridItem>

            <GridItem area="ai">
              <RealTimeDetectionAnalyzer></RealTimeDetectionAnalyzer>
              {/* <Box bg="red">
                <Text fontSize="2xl" textAlign="center">
                  AI Placeholder Content
                </Text>
              </Box> */}
            </GridItem>

            <GridItem area="vis">
              <RealTimeMonitor></RealTimeMonitor>
            </GridItem>

            <GridItem rowSpan={2} colSpan={4} area="controller">
              <MainController></MainController>
            </GridItem>
          </Grid>
        </MainWebsocketsProvider>
      </Box>
    </>
  );
}

export default App;
