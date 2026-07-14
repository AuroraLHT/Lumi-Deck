import {
  Box,
  Button,
  FormLabel,
  Input,
  VStack,
  Grid,
} from "@chakra-ui/react";
import { useRef, useEffect } from "react";

export type RangeValue = number | "auto";

interface STFTToolBarMenuProps {
  RangeMin: RangeValue;
  onRangeMinChange: (min: RangeValue) => void;
  RangeMax: RangeValue;
  onRangeMaxChange: (max: RangeValue) => void;
  FrequencyMin: RangeValue;
  onFrequencyMinChange: (min: RangeValue) => void;
  FrequencyMax: RangeValue;
  onFrequencyMaxChange: (max: RangeValue) => void;
}

const STFTToolBarMenu: React.FC<STFTToolBarMenuProps> = ({
  RangeMin,
  onRangeMinChange,
  RangeMax,
  onRangeMaxChange,
  FrequencyMin,
  onFrequencyMinChange,
  FrequencyMax,
  onFrequencyMaxChange,
}) => {
  const inputRangeMinRef = useRef<HTMLInputElement>(null);
  const inputRangeMaxRef = useRef<HTMLInputElement>(null);
  const inputFrequencyMinRef = useRef<HTMLInputElement>(null);
  const inputFrequencyMaxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRangeMinRef.current)
      inputRangeMinRef.current.value = RangeMin.toString();
    if (inputRangeMaxRef.current)
      inputRangeMaxRef.current.value = RangeMax.toString();
    if (inputFrequencyMinRef.current)
      inputFrequencyMinRef.current.value = FrequencyMin.toString();
    if (inputFrequencyMaxRef.current)
      inputFrequencyMaxRef.current.value = FrequencyMax.toString();
  }, [RangeMin, RangeMax, FrequencyMin, FrequencyMax]);

  const handleRangeChange = (value: string): RangeValue => {
    if (value.toLowerCase() === "auto") {
      return "auto";
    } else {
      const numValue = Number(value);
      return !isNaN(numValue) ? numValue : 0;
    }
  };

  const handleUpdate = () => {
    const rangeMin = handleRangeChange(
      inputRangeMinRef.current?.value || "auto"
    );
    const rangeMax = handleRangeChange(
      inputRangeMaxRef.current?.value || "auto"
    );

    const frequencyMin = handleRangeChange(
      inputFrequencyMinRef.current?.value || "auto"
    );
    const frequencyMax = handleRangeChange(
      inputFrequencyMaxRef.current?.value || "auto"
    );

    onRangeMinChange(rangeMin);
    onRangeMaxChange(rangeMax);

    onFrequencyMinChange(frequencyMin);
    onFrequencyMaxChange(frequencyMax);
  };

  return (
    <Box bg="gray.100" p={4} borderRadius="md" fontSize="sm">
      <VStack spacing={4} align="stretch">
        
        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setFrequencyMin" mb="0" fontSize="xs">
            Frequency Min:
          </FormLabel>
          <Input
            ref={inputFrequencyMinRef}
            defaultValue={FrequencyMin}
            placeholder="Enter minimum frequency or 'auto'"
            size="xs"
            id="setFrequencyMin"
            type="number"
          />
        </Grid>

        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setFrequencyMin" mb="0" fontSize="xs">
            Frequency Max:
          </FormLabel>
          <Input
            ref={inputFrequencyMinRef}
            defaultValue={FrequencyMin}
            placeholder="Enter minimum frequency or 'auto'"
            size="xs"
            id="setFrequencyMin"
            type="number"
          />
        </Grid>

        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setRangeMin" mb="0" fontSize="xs">
            Range Min:
          </FormLabel>
          <Input
            ref={inputRangeMinRef}
            defaultValue={RangeMin}
            placeholder="Enter minimum range or 'auto'"
            size="xs"
            id="setRangeMin"
          />
        </Grid>
        <Grid templateColumns="1fr 2fr" gap={4} alignItems="center">
          <FormLabel htmlFor="setRangeMax" mb="0" fontSize="xs">
            Range Max:
          </FormLabel>
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

export default STFTToolBarMenu;
