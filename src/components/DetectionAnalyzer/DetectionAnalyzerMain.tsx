import {
  Box,
  Button,
  Collapse,
  Flex,
  SimpleGrid,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { useState } from "react";

import useLiveAnalysisStore, { SelectedDetection } from "../../stores/liveAnalysis";
import IntegratorVisualizer from "./IntegratorVisualizer";
import STFTVisualizer from "./STFTVisualizer";
import BBoxEditor from "./BBoxEditor";
import useAnalyzerControl from "../../hooks/useAnalyzerControl";

interface AnalysisToggleProps {
  id: string;
  label: string;
  isChecked: boolean;
  colorScheme: string;
  onChange: (checked: boolean) => void;
}

/**
 * One analysis on/off control.
 *
 * The pair used to be two bare `FormControl`s laid out in a row, which in a
 * 4-of-12 panel put "Short Time FT" and its switch on separate lines with no
 * indication of which switch belonged to which label. Boxing each one and
 * lighting the border when it is on makes the state readable at a glance and
 * keeps the label tied to its control when the pair wraps.
 */
const AnalysisToggle = ({
  id,
  label,
  isChecked,
  colorScheme,
  onChange,
}: AnalysisToggleProps) => (
  // Not `as="label"`: Chakra's Switch renders its own <label>, and nesting one
  // label inside another is invalid HTML that makes a single click toggle twice
  // -- once from the input, once from the outer label retargeting it. The text
  // is bound to the switch with htmlFor instead, which is the same click target
  // without the nesting.
  <Flex
    align="center"
    justify="space-between"
    gap={2}
    px={2.5}
    py={1.5}
    borderWidth="1px"
    borderRadius="md"
    minW={0}
    // Border only, never a fill. The panel behind this is white in light mode
    // and near-black in dark, so any solid swatch that reads in one theme
    // swallows the label in the other; the switch already carries the colour.
    borderColor={isChecked ? `${colorScheme}.400` : "panel.border"}
    _hover={{ borderColor: isChecked ? `${colorScheme}.300` : "panel.borderActive" }}
    transition="border-color 0.15s ease"
  >
    <Text
      as="label"
      htmlFor={id}
      fontSize="xs"
      fontWeight="600"
      color="text.primary"
      noOfLines={1}
      userSelect="none"
      cursor="pointer"
    >
      {label}
    </Text>
    <Switch
      id={id}
      size="sm"
      colorScheme={colorScheme}
      isChecked={isChecked}
      onChange={(e) => onChange(e.target.checked)}
      flexShrink={0}
    />
  </Flex>
);

/** "x 120, y 84 · 64×48" -- the geometry, short enough for a one-line summary. */
const describeBBox = (detection: SelectedDetection) => {
  const [x1, y1, x2, y2] = detection.bbox;
  return `x ${Math.round(x1)}, y ${Math.round(y1)} · ${Math.round(
    x2 - x1
  )}×${Math.round(y2 - y1)}`;
};

const DetectionAnalyzerMain = () => {
  const focusedDetectionID = useLiveAnalysisStore((s) => s.focusedDetectionID);
  const focusedDetection = useLiveAnalysisStore((s) => s.getFocusedDetection());
  const { sendIntegratorRequest, sendSTFTRequest } = useAnalyzerControl();
  const updateFocusedDetection = useLiveAnalysisStore(
    (s) => s.updateFocusedDetection
  );

  // Collapsed by default: the charts are what the panel is for, and eight
  // read-only numbers were pushing them below the fold.
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <VStack align="stretch" spacing={2} minW={0}>
      {focusedDetectionID && focusedDetection && (
        <>
          <Button
            size="xs"
            variant="ghost"
            justifyContent="flex-start"
            leftIcon={
              isDetailsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />
            }
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            px={1}
            minW={0}
          >
            <Flex align="baseline" gap={2} minW={0}>
              <Text fontSize="xs" fontWeight="700" flexShrink={0}>
                {`Box ${focusedDetection.name}`}
              </Text>
              <Text
                fontSize="xs"
                fontWeight="400"
                color="text.secondary"
                noOfLines={1}
              >
                {describeBBox(focusedDetection)}
              </Text>
            </Flex>
          </Button>

          <Collapse in={isDetailsOpen} animateOpacity>
            <BBoxEditor detection={focusedDetection} />
          </Collapse>

          <SimpleGrid minChildWidth="130px" spacing={2}>
            <AnalysisToggle
              id="oscillation-switch"
              label="Oscillation"
              colorScheme="green"
              isChecked={focusedDetection.isRunningOscillation}
              onChange={(checked) => {
                sendIntegratorRequest(
                  checked ? "register" : "remove",
                  focusedDetection
                );
                updateFocusedDetection({ isRunningOscillation: checked });
              }}
            />
            <AnalysisToggle
              id="stft-switch"
              label="Short-time FT"
              colorScheme="blue"
              isChecked={focusedDetection.isRunningSTFT}
              onChange={(checked) => {
                sendSTFTRequest(
                  checked ? "register" : "remove",
                  focusedDetection
                );
                updateFocusedDetection({ isRunningSTFT: checked });
              }}
            />
          </SimpleGrid>
        </>
      )}

      {focusedDetectionID ? (
        <>
          <IntegratorVisualizer />
          <STFTVisualizer />
        </>
      ) : (
        <Box py={8} textAlign="center">
          <Text fontSize="xs" color="text.secondary">
            Select a box to see its traces.
          </Text>
        </Box>
      )}
    </VStack>
  );
};

export default DetectionAnalyzerMain;
