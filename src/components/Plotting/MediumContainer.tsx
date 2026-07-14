import { Box } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
}

/**
 * Surface for a chart inside a panel.
 *
 * Uses `minHeight` rather than a fixed height because panels are resizable now:
 * a chart has to be able to grow with its panel. The old fixed per-breakpoint
 * heights meant a taller panel just gained empty space below the plot.
 */
const MediumContainer: React.FC<Props> = ({ children }: Props) => {
  return (
    <Box
      width="100%"
      flex="1"
      minHeight={{ base: "180px", md: "240px" }}
      bg="plot.bg"
      color="text.primary"
      borderRadius="lg"
      overflow="hidden"
    >
      {children}
    </Box>
  );
};

export default MediumContainer;
