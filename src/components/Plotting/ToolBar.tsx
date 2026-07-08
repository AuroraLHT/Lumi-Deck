import { Box, IconButton, HStack, Collapse } from '@chakra-ui/react'
import { MinusIcon, AddIcon, SettingsIcon } from '@chakra-ui/icons'
import { useState } from 'react';

interface PlottingToolbarProps {
  isMinimized: boolean;
  onMinimize: () => void;
  settingsMenu?: React.ReactNode; // Accept any React component for settings
}

const PlottingToolbar = ({ isMinimized, onMinimize, settingsMenu }: PlottingToolbarProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  return (
    <Box position="relative">
      <Box 
        w="100%" 
        p={2} 
        borderBottom="1px" 
        borderColor="gray.200"
        bg="white"
      >
        <HStack spacing={2} justifyContent="flex-end">
          
          <IconButton
            aria-label="Minimize"
            icon={<SettingsIcon />}
            size="sm"
            variant="ghost"
            onClick={toggleSettings}
          />
          <IconButton
            aria-label="Minimize"
            icon={isMinimized ? <AddIcon /> : <MinusIcon />}
            size="sm"
            variant="ghost"
            onClick={onMinimize}
            />
        </HStack>
      </Box>
      <Box
        position="absolute"
        zIndex={2}
        width="100%"
        top="100%"
      >
        <Collapse in={isSettingsOpen} animateOpacity>
          {settingsMenu}
        </Collapse>
      </Box>
    </Box>
  )
}

export default PlottingToolbar