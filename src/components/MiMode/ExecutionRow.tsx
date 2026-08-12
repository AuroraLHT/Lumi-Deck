import { Badge, Box, Code, Collapse, Flex, Text, Tooltip, keyframes } from "@chakra-ui/react";

import { MIExecution } from "../../generated/lumi";
import { describeExecution, shortUuid, summarizeCommands } from "./executionState";

const pulse = keyframes`
  0%   { opacity: 1; }
  50%  { opacity: 0.25; }
  100% { opacity: 1; }
`;

interface ExecutionRowProps {
  execution: MIExecution;
  isExpanded: boolean;
  onToggle: () => void;
  /** The active script gets its script body shown without being asked. */
  emphasised?: boolean;
}

/**
 * One submitted script: what it is, where it got to, and -- on click -- its full
 * text. Collapsed by default because a growth script is dozens of lines and the
 * panel is four grid columns wide.
 *
 * Everything shown here comes from MI's own report on the script. What the
 * chamber is physically doing afterwards is the Monitor panel's job -- see the
 * note on `describeExecution`'s COMPLETED branch.
 */
const ExecutionRow = ({
  execution,
  isExpanded,
  onToggle,
  emphasised = false,
}: ExecutionRowProps) => {
  const display = describeExecution(execution);

  return (
    <Box
      borderWidth="1px"
      borderColor={emphasised ? "panel.borderActive" : "panel.border"}
      borderRadius="md"
      bg={emphasised ? "panel.bgElevated" : "panel.bg"}
      overflow="hidden"
    >
      <Flex
        align="center"
        gap={2}
        px={2.5}
        py={2}
        cursor="pointer"
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        _hover={{ bg: "panel.header" }}
        minW={0}
      >
        <Box
          w="8px"
          h="8px"
          borderRadius="full"
          bg={display.color}
          flexShrink={0}
          // Only the genuinely-in-progress dot moves. A finished run that kept
          // blinking would read as still going.
          animation={display.isActive ? `${pulse} 1.6s ease-in-out infinite` : undefined}
        />

        <Text
          fontSize="sm"
          color="text.primary"
          noOfLines={1}
          flex="1"
          minW={0}
          fontFamily="mono"
        >
          {summarizeCommands(execution.commands)}
        </Text>

        <Tooltip label={display.hint} openDelay={400} isDisabled={!display.hint}>
          <Badge
            fontSize="0.65rem"
            colorScheme="gray"
            color={display.color}
            bg="transparent"
            borderWidth="1px"
            borderColor={display.color}
            flexShrink={0}
          >
            {display.label}
          </Badge>
        </Tooltip>
      </Flex>

      <Collapse in={isExpanded} animateOpacity>
        <Box px={2.5} pb={2.5} pt={0}>
          <Text fontSize="0.65rem" color="text.muted" mb={1}>
            {shortUuid(execution.commands_uuid)}
          </Text>
          <Code
            display="block"
            whiteSpace="pre"
            overflowX="auto"
            fontSize="xs"
            p={2}
            borderRadius="sm"
            bg="panel.header"
            color="text.secondary"
            maxH="200px"
            overflowY="auto"
          >
            {execution.commands || "(empty script)"}
          </Code>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ExecutionRow;
