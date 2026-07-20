import { Box } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
}

/**
 * Surface for a chart inside a panel.
 *
 * Nivo's Responsive* wrappers are `height: 100%`, which collapses to zero unless
 * their parent has a *definite* height. A bare `minHeight` (auto height) is not
 * definite, so the container needs an explicit `height` or the plot never draws.
 * We lay the container out as a flex column -- toolbar on top, chart filling the
 * rest -- and keep `flex="1"` so the container can still grow when an ancestor
 * flex chain gives it room.
 */
const MediumContainer: React.FC<Props> = ({ children }: Props) => {
  return (
    <Box
      width="100%"
      display="flex"
      flexDirection="column"
      flex="1"
      height={{ base: "220px", md: "300px" }}
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
