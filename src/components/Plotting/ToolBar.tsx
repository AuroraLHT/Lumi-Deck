import { Box, IconButton, HStack, Collapse, Text, Tooltip } from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import { useState } from 'react';

interface PlottingToolbarProps {
  /**
   * Shown on the left of the bar. Charts are stacked now rather than tiled 2x2,
   * and an unlabelled strip of axes is unreadable -- every chart passes one.
   */
  title?: string;
  settingsMenu?: React.ReactNode; // Accept any React component for settings
}

/**
 * The strip above a chart: its name, and a settings drawer.
 *
 * There used to be a minimize button here that flipped an `isVisible` flag in
 * each chart. It only hid the plot -- the surrounding container keeps the fixed
 * height nivo needs to draw at all, so the panel never got any smaller and the
 * button just left a labelled empty box. Panels collapse as a whole from the
 * dashboard header instead, which does reclaim the space.
 */
const PlottingToolbar = ({ title, settingsMenu }: PlottingToolbarProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  return (
    // flexShrink so the bar keeps its height inside the container's flex column
    // and the chart below takes the remaining space.
    <Box position="relative" flexShrink={0}>
      <Box
        w="100%"
        px={2}
        py={1}
        borderBottom="1px"
        borderColor="panel.border"
        bg="panel.header"
      >
        <HStack spacing={2} justifyContent="space-between" minW={0}>
          <Text
            fontSize="xs"
            fontWeight="700"
            letterSpacing="0.05em"
            textTransform="uppercase"
            color="text.secondary"
            noOfLines={1}
          >
            {title}
          </Text>

          <Tooltip label="Chart settings" openDelay={400}>
            <IconButton
              aria-label="Chart settings"
              icon={<SettingsIcon />}
              size="xs"
              variant="ghost"
              onClick={toggleSettings}
              flexShrink={0}
            />
          </Tooltip>
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
