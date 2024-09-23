import { Box, Grid, GridItem, Text, Button, Flex } from "@chakra-ui/react";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import IntegratorVisualizer from "./IntegratorVisualizer";
import useLiveAnalysisClient from "../../clients/liveAnalysis/analyzer";
// import React from "react";

const DetectionAnalyzerMain = () => {
  const focusedDetection = useLiveAnalysisStore(s => s.focusedDetection); // Hook to fetch detections and remove action
  // const removeSelectedDetection = store.removeSelectedDetection;
  const sendIntegratorCommandOperation = useLiveAnalysisClient(s=>s.sendIntegratorCommandOperation);
  const sendSTFTCommandOperation  = useLiveAnalysisClient(s=>s.sendSTFTCommandOperation);

  return (
    <Box>
      {focusedDetection && (
        <>
          <Grid templateColumns="repeat(2, 1fr)" gap={1} mb={5}>
            <GridItem>
              <Flex>
                <Text fontWeight="bold" mr={2}>ID:</Text>
                <Text>{focusedDetection.id}</Text>
              </Flex>
            </GridItem>
            <GridItem>
              <Flex>
              <Text fontWeight="bold">Name:</Text>
              <Text>{focusedDetection.name}</Text>

              </Flex>
            </GridItem>
            <GridItem>
              <Flex>
                <Text fontWeight="bold">Label:</Text>
                <Text>{focusedDetection.label}</Text>
              </Flex>
            </GridItem>
            <GridItem>
              <Flex>
                <Text fontWeight="bold">Score:</Text>
                <Text>{focusedDetection.score.toFixed(2)}</Text>
              </Flex>
            </GridItem>
            <GridItem>
              <Flex>
                <Text fontWeight="bold" mr={2}>Box X:</Text>
                <Text>{`${ ((focusedDetection.bbox[0] + focusedDetection.bbox[2]) / 2).toFixed(1) }`}</Text>
              </Flex>
            </GridItem>
            <GridItem>
              <Flex>
                <Text fontWeight="bold" mr={2}>Box Y:</Text>
                <Text>{`${ ((focusedDetection.bbox[1] + focusedDetection.bbox[3]) / 2).toFixed(1) }`}</Text>
              </Flex>
            </GridItem>

            <GridItem>
              <Flex>
                <Text fontWeight="bold" mr={2}>Box W:</Text>
                <Text>{`${ ((focusedDetection.bbox[2] - focusedDetection.bbox[0]).toFixed(1)) }`}</Text>
              </Flex>
            </GridItem>

            <GridItem>
              <Flex>
                <Text fontWeight="bold" mr={2}>Box H:</Text>
                <Text>{`${ ((focusedDetection.bbox[3] + focusedDetection.bbox[1])).toFixed(1) }`}</Text>
              </Flex>
            </GridItem>


          </Grid>
          <Flex justifyContent="flex-start" gap={2}>
            {/* make this into toggle button */}
            <Button colorScheme="green" onClick={() => sendIntegratorCommandOperation("register", focusedDetection ) }>OSC</Button>
            <Button colorScheme="blue" onClick={() => sendSTFTCommandOperation("register", focusedDetection )}>STFT</Button>
          </Flex>
        </>
      )}
      <IntegratorVisualizer />
    </Box>
  )
}

export default DetectionAnalyzerMain