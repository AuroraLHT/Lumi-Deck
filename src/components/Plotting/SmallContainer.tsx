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
      // `1 0 auto`, never the `flex="1"` shorthand: that expands to `1 1 0%`,
      // and a zero flex-basis *overrides* the height below it. Harmless while
      // the parent was a block box, but the moment one is a flex column the
      // chart collapses to nothing and nivo draws a blank. `auto` keeps the
      // height as the basis while still allowing the growth this is here for.
      flex="1 0 auto"
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
