import { Box, useColorModeValue } from "@chakra-ui/react";

interface Props {
  children: React.ReactNode;
}

const MediumContainer: React.FC<Props> = ({ children }: Props) => {
  const bg = useColorModeValue("white", "white");
  const color = useColorModeValue("black", "black");
  return (
    <Box
      width="100%"
      height={{
        base: "150px",
        sm: "200px",
        md: "250px",
        lg: "300px",
        xl: "350px",
      }}
      bg={bg}
      color={color}
    >
      {children}
    </Box>
  );
};

export default MediumContainer;
