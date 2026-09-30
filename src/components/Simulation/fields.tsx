import { ReactNode, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { LuInfo } from "react-icons/lu";

import { Index3 } from "../../stores/rheedSim";
import { formatIndex, parseIndex } from "./indices";

export const FieldLabel = ({ label, help, unit }: { label: string; help?: string; unit?: string }) => (
  <FormLabel fontSize="xs" mb={1} color="text.secondary" display="flex" alignItems="center" gap={1}>
    {label}
    {unit && (
      <Text as="span" color="text.muted">
        ({unit})
      </Text>
    )}
    {help && (
      <Tooltip label={help} openDelay={200} placement="top-start">
        <Box as="span" display="inline-flex" color="text.muted" tabIndex={0} aria-label={`About ${label}`}>
          <Icon as={LuInfo} boxSize={3} />
        </Box>
      </Tooltip>
    )}
  </FormLabel>
);

/**
 * A number the scene holds. The text is local while it is typed ("-", "0.")
 * and only a finite value inside [min, max] reaches the scene, so the node is
 * never sent something its schema rejects.
 */
export const NumField = ({
  label,
  help,
  unit,
  value,
  onChange,
  min,
  max,
  step,
  precision,
  placeholder,
  nullable = false,
  slider,
}: {
  label: string;
  help?: string;
  unit?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step: number;
  precision?: number;
  placeholder?: string;
  /** Empty is a value: null (the node's default). */
  nullable?: boolean;
  /** A slider under the input over this narrower range, for the values that get dialled. */
  slider?: [number, number];
}) => {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setText((prev) => (Number(prev) === value && prev !== "" ? prev : value === null ? "" : String(value)));
  }, [value]);

  const inRange = (n: number) => Number.isFinite(n) && n >= min && n <= max;
  const invalid = text === "" ? !nullable : !inRange(Number(text));

  return (
    <FormControl isInvalid={invalid}>
      <FieldLabel label={label} help={help} unit={unit} />
      <NumberInput
        size="sm"
        value={text}
        min={min}
        max={max}
        step={step}
        precision={precision}
        keepWithinRange={false}
        clampValueOnBlur={false}
        onChange={(s, n) => {
          setText(s);
          if (s === "" && nullable) onChange(null);
          else if (inRange(n)) onChange(n);
        }}
      >
        <NumberInputField placeholder={placeholder} aria-label={label} />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      {slider && (
        <Slider
          aria-label={`${label} slider`}
          size="sm"
          mt={1}
          min={slider[0]}
          max={slider[1]}
          step={step}
          value={Math.min(slider[1], Math.max(slider[0], value ?? slider[0]))}
          onChange={(n) => {
            const v = precision !== undefined ? +n.toFixed(precision) : n;
            setText(String(v));
            onChange(v);
          }}
        >
          <SliderTrack>
            <SliderFilledTrack />
          </SliderTrack>
          <SliderThumb />
        </Slider>
      )}
    </FormControl>
  );
};

/** Three integer indices, typed as "1 -1 0" or "1-10"; committed on Enter or blur. */
export const IndexField = ({
  label,
  help,
  value,
  brackets,
  onChange,
  error,
  children,
}: {
  label: string;
  help?: string;
  value: Index3;
  brackets: "()" | "[]";
  onChange: (value: Index3) => void;
  /** Why the committed value will not do, e.g. an azimuth off the surface plane. */
  error?: string | null;
  /** Presets under the input. */
  children?: ReactNode;
}) => {
  const [text, setText] = useState(value.join(" "));
  useEffect(() => setText(value.join(" ")), [value]);

  const parsed = parseIndex(text);
  const commit = () => {
    if (!parsed) return;
    if (parsed.every((n) => n === 0)) return;
    onChange(parsed);
  };
  const unparsable = !parsed || parsed.every((n) => n === 0);

  return (
    <FormControl isInvalid={unparsable || Boolean(error)}>
      <FieldLabel label={label} help={help} />
      <HStack spacing={2}>
        <Input
          size="sm"
          fontFamily="mono"
          value={text}
          aria-label={label}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        <Text fontFamily="mono" fontSize="sm" color="text.secondary" flexShrink={0} minW="72px">
          {formatIndex(value, brackets)}
        </Text>
      </HStack>
      {unparsable ? (
        <Text fontSize="xs" color="status.error" mt={1}>
          Three whole numbers, not all zero.
        </Text>
      ) : (
        error && (
          <Text fontSize="xs" color="status.error" mt={1}>
            {error}
          </Text>
        )
      )}
      {children}
    </FormControl>
  );
};
