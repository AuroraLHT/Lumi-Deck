import { Box, Button, Flex, Heading } from "@chakra-ui/react";
import useServerStore from "../stores/nodes/server";

const MainControllerSimulator = () => {
    // ... existing code ...
  
    const setRHEEDNode = useServerStore((s) => s.setRHEEDNodeState);
    const setChamberNode = useServerStore((s) => s.setChamberNodeState);
    const setRHEEDAINode = useServerStore((s) => s.setRHEEDAINodeState);
  
    const simulateNodeChange = (nodeSetter: Function) => {
        const isAvailable = Math.random() > 0.5;
        const isRunning = (Math.random() > 0.5) && isAvailable;

      nodeSetter({
        isRunning: isRunning,
        isAvailable: isAvailable,
      });
    };
  
    // ... existing code ...
  
    return (
      <Box p={5}>
        {/* ... existing JSX ... */}
        
        <Heading as="h3" mb={4}>Simulate Node Changes</Heading>
        <Flex direction="row" mb={4}>
          <Button onClick={() => simulateNodeChange(setRHEEDNode)} mr={2}>
            Simulate RHEED Change
          </Button>
          <Button onClick={() => simulateNodeChange(setChamberNode)} mr={2}>
            Simulate Chamber Change
          </Button>
          <Button onClick={() => simulateNodeChange(setRHEEDAINode)}>
            Simulate RHEED AI Change
          </Button>
        </Flex>
  
        {/* ... rest of the JSX ... */}
      </Box>
    );
}

export default MainControllerSimulator;