import { Text, HStack, Switch, useColorMode } from "@chakra-ui/react";
import HostSelector from "./components/HostSelector";
// import React from 'react'

const navbar = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  // console.log("current color mode", colorMode);
  return (
    <HStack padding="10px" justifyContent="space-between" width="100%">
      <HostSelector></HostSelector>

      <HStack>
        <Switch
          colorScheme="green"
          isChecked={colorMode === "dark"}
          onChange={toggleColorMode}
        />
        <Text whiteSpace="nowrap">Dark Mode</Text>
      </HStack>
    </HStack>
  );
};

export default navbar;
