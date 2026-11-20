import { Box, HStack, Icon, IconButton, Text, VStack } from "@chakra-ui/react";
import { Reorder, useDragControls } from "framer-motion";
import { LuGripVertical, LuPin, LuX } from "react-icons/lu";

import MaskAlignResultView from "./MaskAlignResultView";
import { AUTO_ALIGN_KIND } from "./maskAlign";
import OpForm, { RunControl } from "./OpForm";
import OpLiveContext from "./OpLiveContext";
import { OpSpec } from "./opRegistry";
import useOpForm from "./useOpForm";

/** What some ops show under their form: results richer than the reply line. */
const EXTRAS: Record<string, () => JSX.Element | null> = {
  [AUTO_ALIGN_KIND]: MaskAlignResultView,
};

/**
 * One op on the console: its live readings and its form, with a header to
 * pin, unpin or close it.
 *
 * A Reorder.Item even when unpinned, so pinning moves the same element into
 * the pinned list instead of remounting it -- what the operator already typed
 * stays. Only a pinned card has a drag handle, and dragging starts from the
 * handle alone: anywhere else, a touch scrolls the panel as usual.
 */
const OpCard = ({
  op,
  pinned,
  locked,
  highlighted,
  onTogglePin,
  onClose,
  cardRef,
}: {
  op: OpSpec;
  pinned: boolean;
  locked: boolean;
  highlighted: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  cardRef: (el: HTMLElement | null) => void;
}) => {
  const controls = useDragControls();
  const form = useOpForm(op, locked);
  const Extra = EXTRAS[op.id];

  return (
    <Reorder.Item
      as="div"
      value={op.id}
      dragListener={false}
      dragControls={controls}
      style={{ position: "relative" }}
    >
      <Box
        ref={cardRef}
        bg="panel.bg"
        borderWidth="1px"
        borderColor={highlighted ? "panel.borderActive" : "panel.border"}
        borderRadius="md"
        p={2}
        transition="border-color 0.3s"
      >
        <HStack spacing={1} mb={2}>
          {pinned && (
            <Box
              aria-label={`Drag ${op.label}`}
              cursor="grab"
              color="text.muted"
              display="flex"
              ml={-1}
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                // Otherwise the drag also sweeps a text selection across the panel.
                e.preventDefault();
                controls.start(e);
              }}
            >
              <Icon as={LuGripVertical} boxSize={4} />
            </Box>
          )}
          <Text fontSize="xs" fontWeight="600">
            {op.label}
          </Text>
          <Text fontSize="0.65rem" color="text.muted">
            {op.category}
          </Text>
          <HStack spacing={0} ml="auto">
            <RunControl form={form} />
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={pinned ? `Unpin ${op.label}` : `Pin ${op.label}`}
              title={pinned ? "Unpin" : "Pin -- keep it here when you pick another op"}
              color={pinned ? "accent.solid" : "text.muted"}
              icon={<Icon as={LuPin} boxSize={3.5} fill={pinned ? "currentColor" : "none"} />}
              onClick={onTogglePin}
            />
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={`Close ${op.label}`}
              title="Close"
              color="text.muted"
              icon={<Icon as={LuX} boxSize={3.5} />}
              onClick={onClose}
            />
          </HStack>
        </HStack>
        <VStack align="stretch" spacing={2}>
          <OpLiveContext op={op} />
          <OpForm form={form} />
          {Extra && <Extra />}
        </VStack>
      </Box>
    </Reorder.Item>
  );
};

export default OpCard;
