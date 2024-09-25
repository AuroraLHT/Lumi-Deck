import { IconButton, IconButtonProps } from "@chakra-ui/react";

const CircularButton: React.FC<IconButtonProps> = (props) => (
  <IconButton
    {...props}
    isRound
    size="md"
    // bg="whiteAlpha.200"
    // color="white"
    // _hover={{ bg: "whiteAlpha.300" }}
  />
);

export default CircularButton;
