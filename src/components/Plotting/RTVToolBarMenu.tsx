import { Box, Button, FormLabel, Input, Stack, VStack, Grid, GridItem } from "@chakra-ui/react";
import { useRef, useEffect } from "react";

export type RangeValue = number | "auto";

interface RTVToolBarMenuProps {
  RangeMin: RangeValue;
  onRangeMinChange: (min: RangeValue) => void;
  RangeMax: RangeValue;
  onRangeMaxChange: (max: RangeValue) => void;
  WindowSize: number;
  onWindowSizeChange: (size: number) => void;
}

const RTVToolBarMenu: React.FC<RTVToolBarMenuProps> = ({ RangeMin, onRangeMinChange, RangeMax, onRangeMaxChange, WindowSize, onWindowSizeChange }) => {
  const inputWindowSizeRef = useRef<HTMLInputElement>(null);
  const inputRangeMinRef = useRef<HTMLInputElement>(null);
  const inputRangeMaxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputWindowSizeRef.current) inputWindowSizeRef.current.value = (WindowSize / 1000).toString();
    if (inputRangeMinRef.current) inputRangeMinRef.current.value = RangeMin.toString();
    if (inputRangeMaxRef.current) inputRangeMaxRef.current.value = RangeMax.toString();
  }, [WindowSize, RangeMin, RangeMax]);

  const handleRangeChange = (value: string): RangeValue => {
    if (value.toLowerCase() === "auto") {
      return "auto";
    } else {
      const numValue = Number(value);
      return !isNaN(numValue) ? numValue : 0;
    }
  };

  const handleUpdate = () => {
    const windowSize = Number(inputWindowSizeRef.current?.value || 20) * 1000;
    const rangeMin = handleRangeChange(inputRangeMinRef.current?.value || "auto");
    const rangeMax = handleRangeChange(inputRangeMaxRef.current?.value || "auto");

    onWindowSizeChange(windowSize);
    onRangeMinChange(rangeMin);
    onRangeMaxChange(rangeMax);
  };

  return (
    <Box bg="gray.100" p={4} borderRadius="md" fontSize="sm">
      <VStack spacing={4} align="stretch">
        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setWindowsSize" mb="0" fontSize="xs">Window Size (s):</FormLabel>
          <Input
            ref={inputWindowSizeRef}
            defaultValue={WindowSize}
            placeholder="Enter window size"
            size="xs"
            id="setWindowsSize"
            type="number"
          />
        </Grid>
        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setRangeMin" mb="0" fontSize="xs">Range Min:</FormLabel>
          <Input
            ref={inputRangeMinRef}
            defaultValue={RangeMin}
            placeholder="Enter minimum range or 'auto'"
            size="xs"
            id="setRangeMin"
          />
        </Grid>
        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setRangeMax" mb="0" fontSize="xs">Range Max:</FormLabel>
          <Input
            ref={inputRangeMaxRef}
            defaultValue={RangeMax}
            placeholder="Enter maximum range or 'auto'"
            size="xs"
            id="setRangeMax"
          />
        </Grid>
        <Button onClick={handleUpdate} size="xs">
          Update
        </Button>
      </VStack>
    </Box>
  );
};

export default RTVToolBarMenu;