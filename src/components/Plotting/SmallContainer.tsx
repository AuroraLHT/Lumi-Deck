import { Box } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
}

/** Compact chart surface. See MediumContainer for why the height is a minimum. */
const SmallContainer: React.FC<Props> = ({ children }: Props) => {
  return (
    <Box
      width="100%"
      flex="1"
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
