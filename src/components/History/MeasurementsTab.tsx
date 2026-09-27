import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  IconButton,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { LuMoreVertical, LuPaperclip, LuPlus, LuTrash2 } from "react-icons/lu";

import { MeasurementFileInfo, MeasurementInfo } from "../../generated/lumi";
import { useMeasurement, useSampleMeasurements } from "../../hooks/useHistory";
import useMeasurementWrites from "../../hooks/useMeasurementWrites";
import { errorText, useCanOperate } from "../../hooks/useDriverCall";
import AddMeasurementModal from "./AddMeasurementModal";
import FilePicker from "./FilePicker";
import { PendingFile, UploadStatus, tooBig, useUploader } from "./uploads";
import MeasurementFiles from "./MeasurementFiles";
import SeriesChart from "./SeriesChart";
import { formatTime } from "./history";

const scalar = (v: unknown) =>
  typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "number" ? String(+v.toPrecision(4)) : String(v ?? "--");

/** `detail` / `conditions`, one line: `rms_nm 0.455 · scan_um 5`. Nested values are left out. */
const fieldsLine = (fields: Record<string, unknown> | undefined) =>
  Object.entries(fields ?? {})
    .filter(([, v]) => v === null || typeof v !== "object")
    .map(([k, v]) => `${k} ${scalar(v)}`)
    .join(" · ");

const Curves = ({ measurementId }: { measurementId: number }) => {
  const full = useMeasurement(measurementId);
  if (full.isPending) return <Spinner size="sm" />;
  if (full.isError)
    return (
      <Text fontSize="xs" color="status.error">
        {full.error.message}
      </Text>
    );
  return (
    <VStack align="stretch" spacing={4}>
      {(full.data.series ?? []).map((s) => (
        <Box key={s.name}>
          <Text fontSize="sm" fontWeight="600" mb={1}>
            {s.name}
          </Text>
          <SeriesChart series={s} />
        </Box>
      ))}
    </VStack>
  );
};

/** Attach more files to an existing measurement, from its card. */
const AttachFiles = ({ measurementId, onDone }: { measurementId: number; onDone: () => void }) => {
  const upload = useUploader();
  const toast = useToast();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);

  const setStatus = (key: string, status: UploadStatus) =>
    setFiles((prev) => prev.map((p) => (p.key === key ? { ...p, status } : p)));

  const send = async () => {
    setBusy(true);
    const failed = await upload(measurementId, files, setStatus);
    setBusy(false);
    if (failed === 0) {
      toast({ status: "success", title: `${files.length} file${files.length === 1 ? "" : "s"} attached`, duration: 3000 });
      onDone();
    }
  };

  const pending = files.filter((f) => f.status.state !== "done");
  return (
    <Box borderTop="1px solid" borderColor="panel.border" pt={3}>
      <FilePicker files={files} onChange={setFiles} isDisabled={busy} />
      <HStack justify="end" mt={2}>
        <Button size="xs" variant="ghost" onClick={onDone} isDisabled={busy}>
          Cancel
        </Button>
        <Button
          size="xs"
          colorScheme="blue"
          isLoading={busy}
          isDisabled={!pending.length || files.some(tooBig)}
          onClick={send}
        >
          Upload {pending.length || ""}
        </Button>
      </HStack>
    </Box>
  );
};

const MeasurementCard = ({ m, canOperate }: { m: MeasurementInfo; canOperate: boolean }) => {
  const writes = useMeasurementWrites();
  const toast = useToast();
  const [attaching, setAttaching] = useState(false);

  // Retiring hides, never deletes -- so it is one click with an Undo, not a confirm.
  const undoable = (title: string, undo: () => Promise<unknown>) =>
    toast({
      status: "info",
      duration: 8000,
      isClosable: true,
      render: ({ onClose }) => (
        <HStack bg="panel.bg" border="1px solid" borderColor="panel.border" borderRadius="md" px={4} py={3} boxShadow="lg">
          <Text fontSize="sm" flex={1}>
            {title}
          </Text>
          <Button
            size="xs"
            onClick={() => {
              onClose();
              undo().catch((err) => toast({ status: "error", title: errorText(err) }));
            }}
          >
            Undo
          </Button>
        </HStack>
      ),
    });

  const retireFile = (file: MeasurementFileInfo) =>
    writes
      .retireFile(file)
      .then(() => undoable(`Removed ${file.file_name}`, () => writes.retireFile(file, false)))
      .catch((err) => toast({ status: "error", title: errorText(err) }));

  const retireMeasurement = () =>
    writes
      .retireMeasurement(m.measurement_id)
      .then(() =>
        undoable(`Removed the ${m.kind} measurement`, () => writes.retireMeasurement(m.measurement_id, false))
      )
      .catch((err) => toast({ status: "error", title: errorText(err) }));

  const detail = fieldsLine(m.detail);
  const conditions = fieldsLine(m.conditions);

  return (
    <Box
      as="article"
      aria-label={`${m.kind} measurement`}
      border="1px solid"
      borderColor="panel.border"
      borderRadius="lg"
      p={3}
    >
      <HStack spacing={3} align="start">
        <Box flex={1} minW={0}>
          <HStack spacing={2} flexWrap="wrap" rowGap={1}>
            <Heading size="sm">{m.kind}</Heading>
            {m.value != null && (
              <Text fontSize="sm" fontFamily="mono">
                {scalar(m.value)}
              </Text>
            )}
            {(m.n_series ?? 0) > 0 && (
              <Badge fontSize="0.6rem" colorScheme="blue">
                {m.n_series} curve{m.n_series === 1 ? "" : "s"}
              </Badge>
            )}
            {(m.files?.length ?? 0) > 0 && (
              <Badge fontSize="0.6rem">
                {m.files!.length} file{m.files!.length === 1 ? "" : "s"}
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="text.muted">
            {m.source ?? "no source"} · {formatTime(m.created_at)} · #{m.measurement_id}
          </Text>
        </Box>
        {canOperate && (
          <Menu placement="bottom-end">
            <MenuButton
              as={IconButton}
              aria-label={`Actions for the ${m.kind} measurement`}
              icon={<Icon as={LuMoreVertical} />}
              size="xs"
              variant="ghost"
            />
            <MenuList fontSize="sm">
              <MenuItem icon={<Icon as={LuPaperclip} />} onClick={() => setAttaching(true)}>
                Attach files
              </MenuItem>
              <MenuItem icon={<Icon as={LuTrash2} />} color="status.error" onClick={retireMeasurement}>
                Remove measurement
              </MenuItem>
            </MenuList>
          </Menu>
        )}
      </HStack>

      <VStack align="stretch" spacing={3} mt={2}>
        {detail && <Text fontSize="xs">{detail}</Text>}
        {conditions && (
          <Text fontSize="xs" color="text.muted">
            Grown with: {conditions}
          </Text>
        )}
        {(m.n_series ?? 0) > 0 && <Curves measurementId={m.measurement_id} />}
        <MeasurementFiles files={m.files ?? []} onRetire={canOperate ? retireFile : undefined} />
        {attaching && <AttachFiles measurementId={m.measurement_id} onDone={() => setAttaching(false)} />}
      </VStack>
    </Box>
  );
};

/**
 * What was measured on this sample -- the in-situ RHEED metric and the
 * ex-situ XRD / AFM / transport results -- with their curves and files, and
 * for an operator, the form to add one.
 */
const MeasurementsTab = ({ sampleId, sampleName }: { sampleId: number; sampleName: string }) => {
  const measurements = useSampleMeasurements(sampleId);
  const canOperate = useCanOperate();
  const form = useDisclosure();

  const list = measurements.data?.measurements ?? [];

  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between">
        <Text fontSize="sm" color="text.secondary">
          {measurements.isSuccess && `${list.length} measurement${list.length === 1 ? "" : "s"}`}
        </Text>
        {canOperate && (
          <Button size="sm" colorScheme="blue" leftIcon={<Icon as={LuPlus} />} onClick={form.onOpen}>
            Add measurement
          </Button>
        )}
      </HStack>

      {!measurements.nodeUp ? (
        <Text color="text.muted">The experiment node is not running.</Text>
      ) : measurements.isPending ? (
        <Spinner size="sm" />
      ) : measurements.isError ? (
        <Text color="status.error">{measurements.error.message}</Text>
      ) : !list.length ? (
        <Text color="text.muted">Nothing measured on this sample yet.</Text>
      ) : (
        list.map((m) => <MeasurementCard key={m.measurement_id} m={m} canOperate={canOperate} />)
      )}

      <AddMeasurementModal sampleId={sampleId} sampleName={sampleName} isOpen={form.isOpen} onClose={form.onClose} />
    </VStack>
  );
};

export default MeasurementsTab;
