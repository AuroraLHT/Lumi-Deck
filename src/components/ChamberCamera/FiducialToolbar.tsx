import { HStack, IconButton, Tag, TagCloseButton, TagLabel, Text, Tooltip, Wrap } from "@chakra-ui/react";
import { LuCrosshair, LuSquare, LuHexagon, LuEye, LuEyeOff } from "react-icons/lu";

import { FiducialMarker } from "../../generated/lumi";
import useFiducialUIStore, { FiducialShapeTool } from "../../stores/fiducialUI";
import useFiducialMarkerControl from "../../hooks/useFiducialMarkerControl";

const TOOLS: { tool: FiducialShapeTool; icon: typeof LuCrosshair; label: string }[] = [
  { tool: "cross", icon: LuCrosshair, label: "Place a cross marker" },
  { tool: "rect", icon: LuSquare, label: "Drag a rectangle marker" },
  { tool: "poly", icon: LuHexagon, label: "Click a polygon marker, double-click to close" },
];

interface Props {
  markers: FiducialMarker[];
}

/**
 * The marker toolbar above the Chamber Camera video: shape tools, a show/hide
 * toggle for the overlay, and the list of markers already drawn (click to
 * select, x to remove).
 *
 * A second click on the active tool disarms it -- the same toggle-off a user
 * expects from any drawing tool, and without it the only way to stop drawing
 * was Escape, which is not discoverable.
 */
const FiducialToolbar = ({ markers }: Props) => {
  const activeTool = useFiducialUIStore((s) => s.activeTool);
  const setActiveTool = useFiducialUIStore((s) => s.setActiveTool);
  const selectedMarkerId = useFiducialUIStore((s) => s.selectedMarkerId);
  const selectMarker = useFiducialUIStore((s) => s.selectMarker);
  const markersHidden = useFiducialUIStore((s) => s.markersHidden);
  const setMarkersHidden = useFiducialUIStore((s) => s.setMarkersHidden);
  const { removeMarker } = useFiducialMarkerControl();

  return (
    <HStack justify="space-between" flexWrap="wrap" rowGap={1} className="no-drag">
      <HStack spacing={1}>
        {TOOLS.map(({ tool, icon: ToolIcon, label }) => (
          <Tooltip key={tool} label={label} openDelay={400}>
            <IconButton
              aria-label={label}
              icon={<ToolIcon />}
              size="xs"
              variant={activeTool === tool ? "solid" : "panelGhost"}
              colorScheme={activeTool === tool ? "blue" : undefined}
              onClick={() => setActiveTool(activeTool === tool ? null : tool)}
            />
          </Tooltip>
        ))}
        <Tooltip label={markersHidden ? "Show markers" : "Hide markers"} openDelay={400}>
          <IconButton
            aria-label={markersHidden ? "Show markers" : "Hide markers"}
            icon={markersHidden ? <LuEyeOff /> : <LuEye />}
            size="xs"
            variant={markersHidden ? "solid" : "panelGhost"}
            onClick={() => setMarkersHidden(!markersHidden)}
          />
        </Tooltip>
      </HStack>

      <Wrap spacing={1} flex="1" minW="120px">
        {markers.map((marker) => (
          <Tag
            key={marker.marker_id}
            size="sm"
            variant={marker.marker_id === selectedMarkerId ? "solid" : "subtle"}
            colorScheme={marker.marker_id === selectedMarkerId ? "orange" : "cyan"}
            cursor="pointer"
            onClick={() =>
              selectMarker(marker.marker_id === selectedMarkerId ? null : marker.marker_id)
            }
          >
            <TagLabel>{marker.marker_id}</TagLabel>
            <TagCloseButton
              onClick={(event) => {
                event.stopPropagation();
                removeMarker(marker.marker_id).catch((err) =>
                  console.error("remove_marker failed:", err)
                );
              }}
            />
          </Tag>
        ))}
        {markers.length === 0 && (
          <Text fontSize="xs" color="text.muted">
            No markers yet -- pick a shape and draw on the video.
          </Text>
        )}
      </Wrap>
    </HStack>
  );
};

export default FiducialToolbar;
