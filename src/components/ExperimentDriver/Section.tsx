import { ReactNode } from "react";
import { Box, Text } from "@chakra-ui/react";

/** A titled block inside the driver panel. */
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2}>
    <Text fontSize="xs" fontWeight="600" color="text.secondary" mb={2}>
      {title}
    </Text>
    {children}
  </Box>
);

export default Section;
