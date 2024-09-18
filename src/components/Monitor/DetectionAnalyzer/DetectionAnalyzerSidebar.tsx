// import React from 'react';
import { Box, List, ListItem, IconButton, Text, Flex } from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
// Assuming you have a hook to connect to your store
import useLiveAnalysisStore from "../../../stores/liveAnalysis";
import styles from "./DetectionAnalyzer.module.css";

const DetectionAnalyzerSidebar = () => {
  const store = useLiveAnalysisStore();
  const selectedDetections = store.selectedDetection; // Hook to fetch detections and remove action
  const removeSelectedDetection = store.removeSelectedDetection;
  console.log(selectedDetections);

  return (
    <Box 
      className={styles.sidebar}
      color={"gray.100"}
      h={"20rem"}
      // display="block"
      paddingRight={1}
      paddingLeft={2}
    >
        <List spacing={1}>
          {Object.values(selectedDetections).map((detection, index) => (
            <ListItem key={index} className={styles.listItem} color={"gray.800"}>
              <Flex alignItems="center" justifyContent="space-between">
              <Text color={"gray.600"} size="sm" className={styles.detectionName}>{detection.name}</Text>
              <IconButton
                size="sm"
                color={"red.500"} 
                aria-label="Remove detection"
                icon={<CloseIcon />}
                onClick={() => removeSelectedDetection(detection.id)}
                variant="ghost"
              />
              </Flex>
            </ListItem>
          ))}
        </List>
    </Box>
  );
};

export default DetectionAnalyzerSidebar;
