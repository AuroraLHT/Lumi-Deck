import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Image,
  Link,
  Spinner,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { LuDownload, LuTrash2 } from "react-icons/lu";

import { MeasurementFileInfo } from "../../generated/lumi";
import { useFileFetcher, useMeasurementFile } from "../../hooks/useHistory";
import { errorText } from "../../hooks/useDriverCall";
import { formatBytes, isImage } from "./measurements";

const InlineImage = ({ file }: { file: MeasurementFileInfo }) => {
  const fetched = useMeasurementFile(file.file_id);
  if (fetched.isPending) return <Spinner size="sm" />;
  if (fetched.isError)
    return (
      <Text fontSize="xs" color="status.error">
        {fetched.error.message}
      </Text>
    );
  return (
    <Link href={fetched.data.url} isExternal title="Open full size">
      <Image
        src={fetched.data.url}
        alt={file.description || file.file_name}
        maxH="240px"
        maxW="100%"
        objectFit="contain"
        borderRadius="md"
        border="1px solid"
        borderColor="panel.border"
        bg="black"
      />
    </Link>
  );
};

/** Fetches the bytes and hands them to the browser under the uploaded name. */
const DownloadButton = ({ file }: { file: MeasurementFileInfo }) => {
  const fetchFile = useFileFetcher();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await fetchFile(file.file_id);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      a.click();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="xs"
        variant="outline"
        leftIcon={<Icon as={LuDownload} />}
        isLoading={busy}
        onClick={download}
      >
        Download
      </Button>
      {error && (
        <Text fontSize="xs" color="status.error">
          {error}
        </Text>
      )}
    </>
  );
};

/**
 * A measurement's attached files. Images show inline; everything else --
 * an instrument's raw file nothing here parses yet -- downloads byte for
 * byte under the name it was uploaded with.
 */
const MeasurementFiles = ({
  files,
  onRetire,
}: {
  files: MeasurementFileInfo[];
  /** Given when the viewer may retire files. */
  onRetire?: (file: MeasurementFileInfo) => void;
}) => {
  if (!files.length) return null;
  const images = files.filter(isImage);

  return (
    <VStack align="stretch" spacing={2}>
      {images.length > 0 && (
        <HStack spacing={3} align="start" flexWrap="wrap">
          {images.map((file) => (
            <Box key={file.file_id} maxW="320px">
              <InlineImage file={file} />
            </Box>
          ))}
        </HStack>
      )}
      {files.map((file) => (
        <HStack key={file.file_id} spacing={2} fontSize="xs" flexWrap="wrap" rowGap={1}>
          <Badge fontSize="0.6rem" variant="outline">
            {file.role ?? "raw"}
          </Badge>
          <Text fontFamily="mono" wordBreak="break-all">
            {file.file_name}
          </Text>
          <Text color="text.muted">
            {formatBytes(file.size_bytes)} · {file.media_type}
            {file.description && ` · ${file.description}`}
          </Text>
          <DownloadButton file={file} />
          {onRetire && (
            <Tooltip label="Remove this file (it can be restored)" openDelay={300}>
              <IconButton
                aria-label={`Remove ${file.file_name}`}
                icon={<Icon as={LuTrash2} />}
                size="xs"
                variant="ghost"
                onClick={() => onRetire(file)}
              />
            </Tooltip>
          )}
        </HStack>
      ))}
    </VStack>
  );
};

export default MeasurementFiles;
