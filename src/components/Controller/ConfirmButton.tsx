import { ReactNode, useRef, useState } from "react";
import {
  Button,
  ButtonProps,
  HStack,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Portal,
  Text,
  useDisclosure,
} from "@chakra-ui/react";

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Runs only after the user confirms. May be async; the button shows a spinner. */
  onConfirm: () => void | Promise<void>;
  /** Question shown in the confirmation popover. */
  confirmLabel: string;
  children: ReactNode;
}

/**
 * A button that requires an explicit second click to fire -- for destructive,
 * hard-to-undo actions like killing a node process. Keeps the confirmation
 * inline (a popover) rather than a full modal.
 */
const ConfirmButton = ({
  onConfirm,
  confirmLabel,
  children,
  ...buttonProps
}: ConfirmButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      placement="top-end"
      initialFocusRef={triggerRef}
    >
      <PopoverTrigger>
        <Button {...buttonProps}>{children}</Button>
      </PopoverTrigger>
      <Portal>
        <PopoverContent bg="panel.bgElevated" borderColor="panel.border" w="auto">
          <PopoverArrow bg="panel.bgElevated" />
          <PopoverBody>
            <Text fontSize="sm" mb={2}>
              {confirmLabel}
            </Text>
            <HStack justify="flex-end" spacing={2}>
              <Button size="xs" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                ref={triggerRef}
                size="xs"
                colorScheme="red"
                isLoading={busy}
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </HStack>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

export default ConfirmButton;
