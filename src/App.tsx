// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import  DemoComponent  from "./components/Demo"
import VideoMain from "./components/VideoPlayer/VideoMain";
// import HostSelector from "./components/HostSelector";
import MainController from "./components/MainController";
import MainWebsocketsProvider from "./components/MainWebSockets";
import Navbar from "./navbar";
import { Text, Box, Grid, GridItem } from "@chakra-ui/react";
import RealTimeMonitor from "./components/ChamberStatus/RealTimeMonitor";
// import MainControllerSimulator from "./components/MainControlSimulator"
// import './App.css'

function App() {
  // const [count, setCount] = useState(0)

  return (
    <>
      <Navbar></Navbar>

      <Box padding={4}>
      <MainWebsocketsProvider>
          <Grid
            templateRows="4fr 2fr 6fr"
            templateColumns="4fr 2fr 6fr"
            templateAreas={`
                "video ai vis"
                "controller other other"
              `}
            gap={4}
          >
            <GridItem area="video">
              <VideoMain></VideoMain>
            </GridItem>


            <GridItem area="ai">
              <Box bg="red">
                <Text fontSize="2xl" textAlign="center">
                  AI Placeholder Content
                </Text>
              </Box>
            </GridItem>

            <GridItem area="vis">
              <RealTimeMonitor></RealTimeMonitor>
            </GridItem>


            <GridItem rowSpan={2} colSpan={4} area="controller">
              <MainController></MainController>
            </GridItem>


          </Grid>

        {/* <MainWebsocketsProvider>
          <Grid
            templateRows="repeat(4, 1fr)"
            templateColumns="repeat(12, 1fr)"
            templateAreas={`
                "video ai p_vis o_vis"
                "controller ai t_vis o2_vis"
                "controller "
                "controller "
              `}
            gap={4}
          >
            <GridItem rowSpan={2} colSpan={4} area="video">
              <VideoMain></VideoMain>
            </GridItem>


            <GridItem rowSpan={2} colSpan={2} area="ai">
              <Box bg="red">
                <Text fontSize="2xl" textAlign="center">
                  AI Placeholder Content
                </Text>
              </Box>
            </GridItem>

            <GridItem rowSpan={1} colSpan={3} area="p_vis">
              <RealTImePressure></RealTImePressure>
            </GridItem>

            <GridItem rowSpan={1} colSpan={3} area="o_vis">
              <Box bg="red">
                <Text fontSize="2xl" textAlign="center">
                  Visualization Placeholder Content
                </Text>
              </Box>
            </GridItem>

              
            <GridItem rowSpan={1} colSpan={3} area="t_vis">
              <RealTImeTemperature></RealTImeTemperature>
            </GridItem>

            <GridItem rowSpan={2} colSpan={4} area="controller">
              <MainController></MainController>
            </GridItem>


          </Grid> */}
        </MainWebsocketsProvider>

      </Box>
    </>
  );
}

export default App;
