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
import useLiveAnalysisStore, { SelectedDetection } from "../../stores/liveAnalysis";
import styles from "./DetectionAnalyzer.module.css";
import useAnalyzerControl from "../../hooks/useAnalyzerControl";
import useTransportStore from "../../clients/transport";
import useRegisteredBoxes, {
  refreshRegisteredBoxes,
} from "../../hooks/useRegisteredBoxes";

/** Everything the row cannot show, for the tooltip that replaced the long name. */
const describeBox = (detection: SelectedDetection) => {
  const [x1, y1, x2, y2] = detection.bbox;
  const geometry = `x ${Math.round(x1)}, y ${Math.round(y1)} · ${Math.round(
    x2 - x1
  )}×${Math.round(y2 - y1)}`;
  const running = [
    detection.isRunningOscillation ? "oscillation" : null,
    detection.isRunningSTFT ? "STFT" : null,
  ].filter(Boolean);
  const state = detection.isRegistered
    ? running.length
      ? `running ${running.join(" + ")}`
      : "registered, idle"
    : "local only — not registered on the node";
  return `Box ${detection.name} — ${geometry} — ${state}`;
};

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
 *
 * Rows are labelled with the bare box number. This rail is a fraction of a panel
 * that is itself 4 of 12 grid columns, and "Box 12" had no room to render -- the
 * text was simply clipped away. The number is also the backend's `bbox_id`, so
 * it is the identifier worth showing; everything else is in the tooltip.
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
    <Box className={styles.sidebar} h="100%" px={1} py={1}>
      <Flex alignItems="center" justifyContent="space-between" mb={1.5} gap={1}>
        <Tooltip
          label={
            error
              ? `Could not read the node's boxes: ${error}`
              : "Boxes registered on the RHEED node, shared by every client"
          }
        >
          <Text
            fontSize="10px"
            fontWeight="700"
            letterSpacing="0.04em"
            textTransform="uppercase"
            color={error ? "red.400" : "text.secondary"}
            noOfLines={1}
          >
            {error ? "sync failed" : `${boxes.length} reg.`}
          </Text>
        </Tooltip>
        <Flex alignItems="center" gap={0.5} flexShrink={0}>
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
        <Text fontSize="10px" color="text.secondary" px={1}>
          {isLoading ? "Reading boxes…" : "No boxes. Draw one on the video."}
        </Text>
      )}

      <List spacing={1}>
        {detections.map((detection) => {
          const isFocused = detection.id === focusedDetectionID;
          return (
            <Tooltip
              key={detection.id}
              label={describeBox(detection)}
              placement="right"
              openDelay={300}
            >
              <ListItem
                className={styles.listItem}
                // Semantic tokens, not the gray.800/gray.600 that used to be here:
                // those are dark text, and the panel behind them is dark in dark
                // mode. Same fix the module's CSS comment describes.
                color="text.primary"
                bg={isFocused ? "panel.border" : undefined}
                borderLeft="2px solid"
                borderLeftColor={
                  isFocused ? "panel.borderActive" : "transparent"
                }
                onClick={() => setFocusedDetectionID(detection.id)}
              >
                <Flex alignItems="center" gap={1} minW={0}>
                  <Text
                    className={styles.detectionName}
                    fontSize="sm"
                    fontWeight="700"
                    // Tabular figures so the numbers keep a common width and
                    // the dots beside them do not jitter between rows.
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                    lineHeight="1.2"
                    flexShrink={0}
                  >
                    {detection.name}
                  </Text>

                  {/* These read the node's state, not the switch positions: a
                      register that the node rejected shows up here as a missing
                      dot rather than an "on" toggle over a box nobody is
                      integrating. Dots rather than OSC/FFT text because the rail
                      is too narrow for two words plus a number plus a button. */}
                  <Flex gap={0.5} flex="1" minW={0}>
                    {detection.isRunningOscillation && (
                      <Box
                        w="6px"
                        h="6px"
                        borderRadius="full"
                        bg="green.400"
                        aria-label="Running oscillation"
                      />
                    )}
                    {detection.isRunningSTFT && (
                      <Box
                        w="6px"
                        h="6px"
                        borderRadius="full"
                        bg="blue.400"
                        aria-label="Running STFT"
                      />
                    )}
                    {!detection.isRegistered && (
                      <Badge
                        colorScheme="gray"
                        fontSize="8px"
                        px={1}
                        textTransform="none"
                      >
                        local
                      </Badge>
                    )}
                  </Flex>

                  <IconButton
                    size="xs"
                    color="red.400"
                    aria-label={`Remove box ${detection.name}`}
                    icon={<CloseIcon boxSize={2} />}
                    minW="18px"
                    h="18px"
                    flexShrink={0}
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
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );
};

export default DetectionAnalyzerSidebar;
