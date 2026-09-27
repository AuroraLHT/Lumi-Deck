import { DragEvent, useRef, useState } from "react";
import {
  Box,
  HStack,
  Icon,
  IconButton,
  Input,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCheck, LuAlertTriangle, LuUpload, LuX } from "react-icons/lu";

import { FILE_ROLES, formatBytes, MAX_FILE_BYTES } from "./measurements";
import { PendingFile, UploadStatus, pendingFile, tooBig } from "./uploads";

const StatusLine = ({ status }: { status: UploadStatus }) => {
  switch (status.state) {
    case "uploading":
      return <Text color="text.muted">uploading…</Text>;
    case "done":
      return status.verified === false ? (
        <HStack color="status.error" spacing={1}>
          <Icon as={LuAlertTriangle} />
          <Text>stored, but its checksum does not match what was sent</Text>
        </HStack>
      ) : (
        <HStack color="status.ok" spacing={1}>
          <Icon as={LuCheck} />
          <Text>{status.verified ? "uploaded, checksum matches" : "uploaded"}</Text>
        </HStack>
      );
    case "failed":
      return (
        <HStack color="status.error" spacing={1} align="start">
          <Icon as={LuAlertTriangle} mt="2px" />
          <Text>{status.error}</Text>
        </HStack>
      );
    default:
      return null;
  }
};

/**
 * Files to attach, each with a role (`image` shows inline; `raw` is the
 * instrument's own file). Drop them on the zone or pick them. Over the 15 MiB
 * limit is flagged here, before anything is read or sent.
 */
const FilePicker = ({
  files,
  onChange,
  isDisabled,
}: {
  files: PendingFile[];
  onChange: (files: PendingFile[]) => void;
  isDisabled?: boolean;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const add = (list: FileList | null) => {
    if (list?.length) onChange([...files, ...[...list].map((f) => pendingFile(f))]);
  };
  const update = (key: string, patch: Partial<PendingFile>) =>
    onChange(files.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!isDisabled) add(e.dataTransfer.files);
  };

  return (
    <VStack align="stretch" spacing={2}>
      <Box
        as="button"
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        disabled={isDisabled}
        border="1px dashed"
        borderColor={over ? "accent.solid" : "panel.border"}
        bg={over ? "accent.subtle" : undefined}
        borderRadius="md"
        py={4}
        px={3}
        textAlign="center"
        fontSize="sm"
        color="text.secondary"
        _hover={{ borderColor: "accent.solid" }}
      >
        <Icon as={LuUpload} mr={2} />
        Drop files here or click to choose · up to {formatBytes(MAX_FILE_BYTES)} each
      </Box>
      <Input
        ref={input}
        type="file"
        multiple
        display="none"
        aria-label="Choose files"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      {files.map((p) => (
        <Box key={p.key} fontSize="xs" borderBottom="1px solid" borderColor="panel.border" pb={2}>
          <HStack spacing={2}>
            <Text fontFamily="mono" flex={1} minW={0} noOfLines={1} title={p.file.name}>
              {p.file.name}
            </Text>
            <Text color={tooBig(p) ? "status.error" : "text.muted"} flexShrink={0}>
              {formatBytes(p.file.size)}
            </Text>
            <Select
              size="xs"
              w="90px"
              flexShrink={0}
              aria-label={`Role of ${p.file.name}`}
              value={p.role}
              onChange={(e) => update(p.key, { role: e.target.value })}
              isDisabled={isDisabled || p.status.state === "done"}
            >
              {FILE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
            <IconButton
              aria-label={`Remove ${p.file.name}`}
              icon={<Icon as={LuX} />}
              size="xs"
              variant="ghost"
              isDisabled={isDisabled || p.status.state === "done"}
              onClick={() => onChange(files.filter((f) => f.key !== p.key))}
            />
          </HStack>
          <Input
            size="xs"
            mt={1}
            placeholder="Description (optional)"
            aria-label={`Description of ${p.file.name}`}
            value={p.description}
            onChange={(e) => update(p.key, { description: e.target.value })}
            isDisabled={isDisabled || p.status.state === "done"}
          />
          {tooBig(p) ? (
            <Text color="status.error" mt={1}>
              Over the {formatBytes(MAX_FILE_BYTES)} limit for one file.
            </Text>
          ) : (
            <Box mt={1}>
              <StatusLine status={p.status} />
            </Box>
          )}
        </Box>
      ))}
    </VStack>
  );
};

export default FilePicker;
