// import React from 'react';
import {
  Badge,
  Box,
  Flex,
  IconButton,
  List,
  ListItem,
  Spinner,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { CloseIcon, RepeatIcon } from "@chakra-ui/icons";
// Assuming you have a hook to connect to your store
import useLiveAnalysisStore from "../../stores/liveAnalysis";
import styles from "./DetectionAnalyzer.module.css";
import useAnalyzerControl from "../../hooks/useAnalyzerControl";
import useTransportStore from "../../clients/transport";
import useRegisteredBoxes, {
  refreshRegisteredBoxes,
} from "../../hooks/useRegisteredBoxes";

/**
 * The box list.
 *
 * It reads from `useLiveAnalysisStore`, which is now a merge of two things
 * rather than one: boxes drawn in this browser, and boxes the *node* has
 * registered -- folded in by `useBackendBoxReconciliation`. So a box another
 * client created, or one that was registered before this page was last
 * reloaded, is listed here without the user doing anything. The badges say which
 * of the two a row is, because the difference matters: a local box is invisible
 * to everyone else and will not survive a reload.
 */
const DetectionAnalyzerSidebar = () => {
  const selectedDetections = useLiveAnalysisStore((s) => s.selectedDetection); // Hook to fetch detections and remove action
  const removeSelectedDetection = useLiveAnalysisStore(
    (s) => s.removeSelectedDetection
  );
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);
  const setFocusedDetectionID = useLiveAnalysisStore(
    (s) => s.setFocusedDetectionID
  );
  const { sendIntegratorRequest, sendSTFTRequest } = useAnalyzerControl();
  const transport = useTransportStore((s) => s.transport);
  const { boxes, isLoading, error, isSyncing } = useRegisteredBoxes();

  const detections = Object.values(selectedDetections);

  return (
    <Box
      className={styles.sidebar}
      h={"20rem"}
      // display="block"
      paddingRight={1}
      paddingLeft={2}
    >
      <Flex alignItems="center" justifyContent="space-between" mb={1} pr={1}>
        <Tooltip
          label={
            error
              ? `Could not read the node's boxes: ${error}`
              : "Boxes registered on the RHEED node, shared by every client"
          }
        >
          <Text fontSize="xs" color={error ? "red.400" : "text.secondary"}>
            {error ? "sync failed" : `${boxes.length} registered`}
          </Text>
        </Tooltip>
        <Flex alignItems="center" gap={1}>
          {(isLoading || isSyncing) && <Spinner size="xs" />}
          <Tooltip label="Re-read the registered boxes now">
            <IconButton
              size="xs"
              aria-label="Refresh registered boxes"
              icon={<RepeatIcon />}
              variant="ghost"
              isDisabled={!transport}
              onClick={() => {
                if (transport) void refreshRegisteredBoxes(transport);
              }}
            />
          </Tooltip>
        </Flex>
      </Flex>

      {detections.length === 0 && (
        <Text fontSize="xs" color="text.secondary" px={1}>
          {isLoading
            ? "Reading the node's boxes..."
            : "No boxes. Draw one on the video to start."}
        </Text>
      )}

      <List spacing={1}>
        {detections.map((detection) => (
          <ListItem
            key={detection.id}
            className={styles.listItem}
            // Semantic tokens, not the gray.800/gray.600 that used to be here:
            // those are dark text, and the panel behind them is dark in dark
            // mode. Same fix the module's CSS comment describes.
            color="text.primary"
            bg={detection.id === focusedDetectionID ? "panel.border" : undefined}
            borderLeft="2px solid"
            borderLeftColor={
              detection.id === focusedDetectionID
                ? "panel.borderActive"
                : "transparent"
            }
            onClick={() => setFocusedDetectionID(detection.id)}
          >
            <Flex alignItems="center" justifyContent="space-between">
              <Box minW={0}>
                <Text
                  color="text.primary"
                  size="sm"
                  className={styles.detectionName}
                  noOfLines={1}
                >
                  {detection.name}
                </Text>
                <Flex gap={1} mt={0.5}>
                  {/* These read the node's state, not the switch positions: a
                      register that the node rejected shows up here as a missing
                      badge rather than an "on" toggle over a box nobody is
                      integrating. */}
                  {detection.isRunningOscillation && (
                    <Badge colorScheme="green" fontSize="0.6rem">
                      OSC
                    </Badge>
                  )}
                  {detection.isRunningSTFT && (
                    <Badge colorScheme="blue" fontSize="0.6rem">
                      FFT
                    </Badge>
                  )}
                  {!detection.isRegistered && (
                    <Tooltip label="Only in this browser -- not registered on the node, and lost on reload">
                      <Badge colorScheme="gray" fontSize="0.6rem">
                        local
                      </Badge>
                    </Tooltip>
                  )}
                </Flex>
              </Box>
              <IconButton
                size="sm"
                color={"red.500"}
                aria-label="Remove detection"
                icon={<CloseIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSelectedDetection(detection.id);
                  sendIntegratorRequest("remove", detection);
                  sendSTFTRequest("remove", detection);
                }}
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
