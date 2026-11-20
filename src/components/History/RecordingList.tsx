import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuSearch } from "react-icons/lu";

import { useRecordings } from "../../hooks/useHistory";
import { formatDuration, formatTime } from "./history";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Every file in the storage node's archive, newest first -- including the
 * ones no sample journal names (started from the Storage panel, or before the
 * driver kept a journal) and the one being recorded now.
 */
const RecordingList = ({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (name: string) => void;
}) => {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const recordings = useRecordings(query);
  const list = recordings.data?.recordings ?? [];

  return (
    <VStack align="stretch" spacing={2} h="100%" minH={0}>
      <InputGroup size="sm">
        <InputLeftElement pointerEvents="none">
          <Icon as={LuSearch} color="text.muted" />
        </InputLeftElement>
        <Input
          placeholder="Search recordings"
          aria-label="Search recordings"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          borderRadius="md"
        />
      </InputGroup>

      <Box flex={1} minH={0} overflowY="auto" mx={-1} px={1}>
        {!recordings.nodeUp ? (
          <Text fontSize="sm" color="text.muted" py={4}>
            The storage node is not running, so recordings cannot be listed.
          </Text>
        ) : recordings.isPending ? (
          <HStack py={4} color="text.muted">
            <Spinner size="sm" />
            <Text fontSize="sm">Loading recordings…</Text>
          </HStack>
        ) : recordings.isError ? (
          <Text fontSize="sm" color="status.error" py={4}>
            {recordings.error.message}
          </Text>
        ) : list.length === 0 ? (
          <Text fontSize="sm" color="text.muted" py={4}>
            No recordings match.
          </Text>
        ) : (
          <VStack align="stretch" spacing={0.5}>
            {list.map((r) => (
              <Button
                key={r.name}
                variant="ghost"
                size="sm"
                h="auto"
                py={1.5}
                px={2}
                display="block"
                textAlign="left"
                fontWeight="500"
                isActive={r.name === selected}
                aria-current={r.name === selected ? "true" : undefined}
                _active={{ bg: "accent.subtle", color: "accent.solid" }}
                onClick={() => onSelect(r.name)}
              >
                <HStack spacing={1.5} minW={0}>
                  <Text as="span" noOfLines={1} flex={1} minW={0} title={r.name}>
                    {r.name}
                  </Text>
                  {r.recording && (
                    <Badge colorScheme="red" fontSize="0.55rem">
                      Rec
                    </Badge>
                  )}
                  <Badge variant="outline" fontSize="0.55rem" flexShrink={0}>
                    {r.format_version ? `v${r.format_version}` : "v1"}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color="text.muted" fontWeight="400" noOfLines={1}>
                  {r.error
                    ? `Unreadable: ${r.error}`
                    : `${formatTime(r.start ?? r.modified)} · ${formatDuration(
                        (r.end ?? 0) - (r.start ?? 0)
                      )} · ${((r.size_bytes ?? 0) / 1e6).toFixed(0)} MB`}
                </Text>
                {(r.operator || r.note) && (
                  <Text fontSize="xs" color="text.secondary" fontWeight="400" noOfLines={1}>
                    {[r.operator, r.note].filter(Boolean).join(" — ")}
                  </Text>
                )}
              </Button>
            ))}
            {(recordings.data?.total ?? 0) > list.length && (
              <Text fontSize="xs" color="text.muted" px={2}>
                Showing {list.length} of {recordings.data?.total}. Narrow the search to see the rest.
              </Text>
            )}
          </VStack>
        )}
      </Box>
    </VStack>
  );
};

export default RecordingList;
