import { ReactNode, forwardRef } from "react";
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
} from "@chakra-ui/icons";
import { LuGripVertical } from "react-icons/lu";

/** Class the grid uses as its drag handle. Only the header grabs. */
export const PANEL_DRAG_HANDLE = "panel-drag-handle";

interface PanelProps {
  title: string;
  children: ReactNode;

  collapsed?: boolean;
  /** Hides the drag grip and the resize affordance cue. */
  locked?: boolean;

  onCollapse?: () => void;
  onRemove?: () => void;

  /** Rendered in the header, left of the window controls (e.g. a live badge). */
  headerAccessory?: ReactNode;

  // react-grid-layout injects these on the element it positions. They must be
  // forwarded to the outermost node or the panel will not move.
  style?: React.CSSProperties;
  className?: string;
  onMouseDown?: React.MouseEventHandler;
  onMouseUp?: React.MouseEventHandler;
  onTouchEnd?: React.TouchEventHandler;
}

/**
 * The chrome around every dashboard panel: a grab handle, collapse and close,
 * plus a scrollable body.
 *
 * `forwardRef` and the pass-through of style/className/mouse handlers are
 * required by react-grid-layout, which clones this element and positions it.
 */
const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      title,
      children,
      collapsed = false,
      locked = false,
      onCollapse,
      onRemove,
      headerAccessory,
      style,
      className,
      onMouseDown,
      onMouseUp,
      onTouchEnd,
      ...rest
    },
    ref
  ) => {
    return (
      <Box
        ref={ref}
        style={style}
        className={className}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchEnd={onTouchEnd}
        {...rest}
        display="flex"
        flexDirection="column"
        overflow="hidden"
        bg="panel.bg"
        border="1px solid"
        borderColor="panel.border"
        borderRadius="xl"
        boxShadow="sm"
        transition="border-color 0.15s ease, box-shadow 0.15s ease"
        _hover={{ borderColor: locked ? "panel.border" : "panel.borderActive" }}
      >
        <Flex
          className={locked ? undefined : PANEL_DRAG_HANDLE}
          align="center"
          justify="space-between"
          px={2.5}
          py={1.5}
          bg="panel.header"
          borderBottom="1px solid"
          borderColor="panel.border"
          flexShrink={0}
          cursor={locked ? "default" : "grab"}
          _active={{ cursor: locked ? "default" : "grabbing" }}
          // Keep long titles from pushing the controls off the edge.
          minW={0}
        >
          <HStack spacing={1.5} minW={0}>
            {!locked && (
              <Box color="text.muted" flexShrink={0} aria-hidden>
                <LuGripVertical size={14} />
              </Box>
            )}
            <Text
              fontSize="xs"
              fontWeight="700"
              letterSpacing="0.06em"
              textTransform="uppercase"
              color="text.secondary"
              noOfLines={1}
            >
              {title}
            </Text>
          </HStack>

          <HStack spacing={0.5} flexShrink={0}>
            {headerAccessory}

            {onCollapse && (
              <Tooltip label={collapsed ? "Expand" : "Collapse"} openDelay={400}>
                <IconButton
                  aria-label={collapsed ? "Expand panel" : "Collapse panel"}
                  icon={collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                  size="xs"
                  variant="panelGhost"
                  onClick={onCollapse}
                />
              </Tooltip>
            )}

            {onRemove && (
              <Tooltip label="Remove" openDelay={400}>
                <IconButton
                  aria-label="Remove panel"
                  icon={<CloseIcon boxSize={2} />}
                  size="xs"
                  variant="panelGhost"
                  onClick={onRemove}
                  _hover={{ bg: "status.error", color: "white" }}
                />
              </Tooltip>
            )}
          </HStack>
        </Flex>

        {!collapsed && (
          <Box flex="1" minH={0} overflow="auto" p={2}>
            {children}
          </Box>
        )}
      </Box>
    );
  }
);

Panel.displayName = "Panel";

export default Panel;
