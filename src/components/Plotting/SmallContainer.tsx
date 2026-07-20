import { Box } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
}

/** Compact chart surface. See MediumContainer for why the height must be definite. */
const SmallContainer: React.FC<Props> = ({ children }: Props) => {
  return (
    <Box
      width="100%"
      display="flex"
      flexDirection="column"
      flex="1"
      height={{ base: "180px", md: "240px" }}
      minHeight={{ base: "140px", md: "180px" }}
      bg="plot.bg"
      color="text.primary"
      borderRadius="lg"
      overflow="hidden"
    >
      {children}
    </Box>
  );
};

export default SmallContainer;
