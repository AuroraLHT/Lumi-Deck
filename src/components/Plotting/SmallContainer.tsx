import { Box, useColorModeValue } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
}

const SmallContainer: React.FC<Props> = ({ children }: Props) => {
  const bg = useColorModeValue("white", "white");
  const color = useColorModeValue("black", "black");
  return (
    <Box
      width="100%"
      height={{
        base: "100px",
        sm: "150px",
        md: "200px",
        lg: "250px",
        xl: "300px",
      }}
      bg={bg}
      color={color}
    >
      {children}
    </Box>
  );
};

export default SmallContainer;
