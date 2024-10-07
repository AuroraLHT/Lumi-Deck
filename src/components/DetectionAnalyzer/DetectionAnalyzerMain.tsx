import { Box, Grid, GridItem, Text, Flex, Switch, FormControl, FormLabel } from "@chakra-ui/react";
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import IntegratorVisualizer from "./IntegratorVisualizer";
import STFTVisualizer from "./STFTVisualizer";
import useLiveAnalysisClient from "../../clients/liveAnalysis/analyzer";
// import React from "react";

const DetectionAnalyzerMain = () => {
  const focusedDetectionID = useLiveAnalysisStore(s => s.focusedDetectionID); // Hook to fetch detections and remove action
  const focusedDetection = useLiveAnalysisStore(s => s.getFocusedDetection());
  // const removeSelectedDetection = store.removeSelectedDetection;
  const sendIntegratorCommandOperation = useLiveAnalysisClient(s=>s.sendIntegratorCommandOperation);
  const sendSTFTCommandOperation  = useLiveAnalysisClient(s=>s.sendSTFTCommandOperation);
  const updateFocusedDetection = useLiveAnalysisStore(s => s.updateFocusedDetection);

  return (
    <Box>
      {(focusedDetectionID && focusedDetection) && (
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
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="oscillation-switch" mb="0">
                Oscillation
              </FormLabel>
              <Switch
                id="oscillation-switch"
                colorScheme="green"
                isChecked={focusedDetection.isRunningOscillation}
                onChange={(e) => {
                  const operation = e.target.checked ? "register" : "remove";
                  sendIntegratorCommandOperation(operation, focusedDetection);
                  updateFocusedDetection({
                    isRunningOscillation: e.target.checked
                  })
                }}
              />
            </FormControl>
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="stft-switch" mb="0">
                Short Time FT
              </FormLabel>
              <Switch
                id="stft-switch"
                colorScheme="blue"
                isChecked={focusedDetection.isRunningSTFT}
                onChange={(e) => {
                  const operation = e.target.checked ? "register" : "remove";
                  sendSTFTCommandOperation(operation, focusedDetection);
                  updateFocusedDetection({
                    isRunningSTFT: e.target.checked
                  })
                }}
              />
            </FormControl>
          </Flex>
        </>
      )}
      {focusedDetectionID && (
        <>
          <IntegratorVisualizer />
          <STFTVisualizer />
        </>
      )}
    </Box>
  )
}

export default DetectionAnalyzerMain