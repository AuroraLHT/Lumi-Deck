import { KeyboardEvent, useMemo, useRef, useState } from "react";
import {
  Box,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverAnchor,
  PopoverBody,
  PopoverContent,
  Portal,
  Text,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { LuPin } from "react-icons/lu";

import { OP_CATEGORIES, OP_REGISTRY, OpSpec } from "./opRegistry";

const matches = (op: OpSpec, q: string) =>
  `${op.label} ${op.category} ${op.id.replace(/_/g, " ")}`.toLowerCase().includes(q);

/**
 * The console's entry point: a search box whose dropdown lists every op,
 * grouped by category, narrowed as you type. Focusing it opens the full list
 * (a tablet has no keyboard to start typing with); Enter picks the first
 * match and the arrow keys move through the rest.
 */
const OpPicker = ({
  selectedId,
  pinned,
  onSelect,
}: {
  selectedId: string | null;
  pinned: string[];
  onSelect: (op: OpSpec) => void;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => OP_REGISTRY.filter((op) => matches(op, q)), [q]);
  // Display order, so arrow keys walk the list in the order it is drawn.
  const ordered = useMemo(
    () => OP_CATEGORIES.flatMap((cat) => filtered.filter((op) => op.category === cat)),
    [filtered]
  );

  const pick = (op: OpSpec) => {
    onSelect(op);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, ordered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const op = ordered[active];
      if (op) pick(op);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <Popover
      isOpen={open}
      onClose={() => setOpen(false)}
      placement="bottom-start"
      autoFocus={false}
      returnFocusOnClose={false}
      matchWidth
      isLazy
    >
      <PopoverAnchor>
        <InputGroup size="sm">
          <InputLeftElement pointerEvents="none">
            <SearchIcon boxSize={3} color="text.muted" />
          </InputLeftElement>
          <Input
            ref={inputRef}
            placeholder="Search operations…"
            aria-label="Search operations"
            value={query}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
        </InputGroup>
      </PopoverAnchor>
      <Portal>
        <PopoverContent
          bg="panel.bgElevated"
          borderColor="panel.border"
          w="auto"
          minW="220px"
          // Keep the input focused when a row is pressed, so the blur does not
          // close the list before the click lands.
          onMouseDown={(e) => e.preventDefault()}
        >
          <PopoverBody p={1} maxH="320px" overflowY="auto">
            {ordered.length === 0 && (
              <Text fontSize="xs" color="text.muted" px={2} py={1}>
                No operation matches “{query}”.
              </Text>
            )}
            {OP_CATEGORIES.map((cat) => {
              const ops = ordered.filter((op) => op.category === cat);
              if (ops.length === 0) return null;
              return (
                <Box key={cat} mb={1}>
                  <Text fontSize="0.65rem" fontWeight="600" color="text.secondary" px={2} pt={1}>
                    {cat.toUpperCase()}
                  </Text>
                  {ops.map((op) => {
                    const idx = ordered.indexOf(op);
                    const isActive = idx === active;
                    return (
                      <Box
                        key={op.id}
                        role="option"
                        aria-selected={isActive}
                        px={2}
                        py="3px"
                        borderRadius="sm"
                        fontSize="xs"
                        cursor="pointer"
                        bg={isActive ? "accent.subtle" : undefined}
                        fontWeight={selectedId === op.id ? "600" : undefined}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => pick(op)}
                      >
                        <HStack spacing={1}>
                          <Text as="span">{op.label}</Text>
                          {pinned.includes(op.id) && (
                            <Icon as={LuPin} boxSize={3} color="text.muted" aria-label="pinned" />
                          )}
                        </HStack>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

export default OpPicker;
