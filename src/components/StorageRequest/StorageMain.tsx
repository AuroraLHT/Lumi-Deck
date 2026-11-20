import React, { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputRightAddon,
  SimpleGrid,
  Switch,
  Text,
  Textarea,
  Tooltip,
  VStack,
  Wrap,
  WrapItem,
  useToast,
} from "@chakra-ui/react";
import { useForm, SubmitHandler } from "react-hook-form";
import { MdFiberManualRecord, MdStop, MdWarningAmber } from "react-icons/md";
import { RecordingSummary, StorageArchiveClient, StorageStorageClient } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useAuthStore from "../../stores/auth";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import useStorageNodeStore from "../../stores/nodes/storage";

interface StorageFormValues {
  project_name: string;
  save_frame: boolean;
  save_ai: boolean;
  save_log: boolean;
  save_integration: boolean;
  /** Text as typed; empty is the lab's usual energy. */
  rheed_energy_kev: string;
  /** Empty is the signed-in user. */
  operator: string;
  note: string;
}

/** How often the counts of the recording in progress are re-read. */
const LIVE_POLL_MS = 5000;

/**
 * What a v2 recording keeps besides the data, by the node it comes from. The
 * storage node snapshots each at the start and logs changes as events, so a
 * source that is down when Record is pressed is simply missing from the file.
 */
const META_SOURCES: { dep: string; label: string }[] = [
  { dep: "chamber", label: "Chamber state" },
  { dep: "chamber", label: "Log columns" },
  { dep: "rheed", label: "Camera settings" },
  { dep: "rheed", label: "Integration boxes" },
  { dep: "detection", label: "Detector model and crop" },
];

/** The file stem the archive names a recording by, from the node's path. */
const recordingName = (path: string | null) =>
  path ? path.replace(/^.*[\\/]/, "").replace(/\.(hdf5|h5)$/i, "") : null;

const formatMb = (bytes: number) => `${(bytes / 1e6).toFixed(bytes < 1e8 ? 1 : 0)} MB`;

/**
 * The recording in progress, re-read from the archive while it runs. v2 files
 * can be read mid-recording, so these are the counts on disk, not the node's
 * own estimate. Null for a v1 node, which refuses to open an open file.
 */
const useLiveRecording = (name: string | null): RecordingSummary | null => {
  const transport = useTransportStore((s) => s.transport);
  const [summary, setSummary] = useState<RecordingSummary | null>(null);

  useEffect(() => {
    setSummary(null);
    if (!transport || !name) return;
    let cancelled = false;
    const archive = new StorageArchiveClient(transport);
    const poll = () =>
      archive
        .list_recordings({ search: name, limit: 5 })
        .then((list) => {
          if (cancelled) return;
          setSummary(list.recordings?.find((r) => r.name === name) ?? null);
        })
        .catch(() => {
          if (!cancelled) setSummary(null);
        });
    poll();
    const timer = window.setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [transport, name]);

  return summary;
};

/**
 * How long to keep the button busy waiting for the node to confirm.
 *
 * The RPC returning ok=true is not the same as the node reporting is_storing:
 * the flag arrives on the next heartbeat, up to ~2s later. Without a ceiling a
 * node that answers and then dies would leave the button disabled forever.
 */
const CONFIRM_TIMEOUT_MS = 8000;

const OPTIONS: { key: "save_frame" | "save_ai" | "save_log" | "save_integration"; label: string }[] = [
  { key: "save_frame", label: "Frames" },
  { key: "save_ai", label: "Detections" },
  { key: "save_log", label: "Chamber log" },
  { key: "save_integration", label: "Integrations" },
];

/** The contract takes (0, 200] keV; empty (or anything else) is null, the lab's default. */
const energyKev = (text: string) => {
  const n = Number(text);
  return text.trim() !== "" && Number.isFinite(n) && n > 0 && n <= 200 ? n : null;
};

const StorageMain: React.FC = () => {
  const { register, handleSubmit, watch } = useForm<StorageFormValues>({
    defaultValues: {
      save_frame: true,
      save_ai: true,
      save_log: true,
      save_integration: true,
      rheed_energy_kev: "",
      operator: "",
      note: "",
    },
  });
  const transport = useTransportStore((s) => s.transport);
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const signedInAs = user ? user.full_name || user.username : null;
  // The driver's session, saved as the recording's experiment context so a file
  // started from this panel still says which sample and pixel it was.
  const driverProject = useExperimentDriverNodeStore((s) => s.state.project_name);
  const driverSubstrate = useExperimentDriverNodeStore((s) => s.state.substrate_id);
  const driverPixel = useExperimentDriverNodeStore((s) => s.state.current_pixel_index);

  // Recording is the node's state, shared by every client -- not this tab's.
  // It arrives on the storage node's heartbeat via the system registry, so a
  // session started in another browser (or before this page was loaded) shows
  // up here within about two seconds, and stopping it there stops it here.
  const isStoring = useStorageNodeStore((s) => s.state.is_storing);
  const isAvailable = useStorageNodeStore((s) => s.state.is_available);
  const activeProject = useStorageNodeStore((s) => s.state.project_name);
  const activePath = useStorageNodeStore((s) => s.state.path);
  // Joined rather than selected as an object: the registry rebuilds its records
  // from JSON on every reconcile, so a `deps_available` selector hands back a
  // fresh object each time and re-renders this panel for no change. A string
  // compares by value.
  const missingDepsKey = useStorageNodeStore((s) =>
    Object.entries(s.state.deps_available)
      .filter(([, up]) => !up)
      .map(([name]) => name)
      .sort()
      .join(",")
  );

  // The is_storing we asked for, held until the node reports it. This is what
  // covers the gap between the RPC returning and the next heartbeat landing --
  // the button would otherwise snap back to its old face for a second or two
  // and invite a second click.
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingTarget === null) return;
    if (isStoring === pendingTarget) {
      setPendingTarget(null);
      return;
    }
    timeoutRef.current = window.setTimeout(
      () => setPendingTarget(null),
      CONFIRM_TIMEOUT_MS
    );
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [isStoring, pendingTarget]);

  const isBusy = pendingTarget !== null;
  // Show the pending face while waiting, so one click gives one visible change.
  const showsRecording = pendingTarget ?? isStoring;

  const missingDeps = missingDepsKey ? missingDepsKey.split(",") : [];
  const live = useLiveRecording(isStoring ? recordingName(activePath) : null);

  const onSubmit: SubmitHandler<StorageFormValues> = async (data) => {
    if (!transport) {
      toast({
        title: "Not connected",
        description: "No connection to the server. Check the selected host.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const client = new StorageStorageClient(transport);
    // Decide against the node's state, not a local flag: if another client
    // started a recording, this button must stop *that* one rather than try to
    // start a second.
    const wasStoring = isStoring;
    setPendingTarget(!wasStoring);

    try {
      const status = wasStoring
        ? await client.stop_recording()
        : await client.start_recording({
            ...data,
            rheed_energy_kev: energyKev(data.rheed_energy_kev),
            operator: data.operator.trim() || signedInAs,
            note: data.note.trim() || null,
            context: {
              source: "lumi-deck storage panel",
              ...(driverProject != null && { project_name: driverProject }),
              ...(driverSubstrate != null && { substrate_id: driverSubstrate }),
              ...(driverPixel != null && { pixel_index: driverPixel }),
            },
          });

      if (status.ok) {
        toast({
          title: "Success",
          description:
            status.message ?? (wasStoring ? "Recording stopped" : "Recording started"),
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        // The node refused, so it never changed state -- stop waiting for a
        // confirmation that is not coming.
        setPendingTarget(null);
        toast({
          title: wasStoring ? "Could not stop recording" : "Could not start recording",
          description: status.message,
          status: "warning",
          duration: 4000,
          isClosable: true,
        });
      }
    } catch (error) {
      setPendingTarget(null);
      console.error("Error submitting form:", error);
      toast({
        title: "Error",
        // The capability rejects with `[ErrorType] message`, which says more than
        // a generic failure notice -- surface it.
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit storage request. Check Network Connection.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const energyText = watch("rheed_energy_kev");
  const energyInvalid = energyText !== "" && energyKev(energyText) === null;

  return (
    <VStack
      as="form"
      id="storageForm"
      onSubmit={handleSubmit(onSubmit)}
      align="stretch"
      spacing={3}
      p={2}
    >
      {/* What the node is doing now -- shared by every client, so a session
          started elsewhere shows here too. */}
      <HStack spacing={2} minW={0}>
        {!isAvailable ? (
          <Badge variant="subtle" colorScheme="gray">
            Offline
          </Badge>
        ) : isStoring ? (
          <Badge variant="subtle" colorScheme="red" display="flex" alignItems="center" gap={1}>
            <Box w="6px" h="6px" borderRadius="full" bg="red.400" />
            Recording
          </Badge>
        ) : (
          <Badge variant="subtle" colorScheme="gray">
            Idle
          </Badge>
        )}
        <Text fontSize="xs" color="text.muted" noOfLines={1} title={activePath ?? undefined}>
          {!isAvailable
            ? "The storage node is not on the bus"
            : isStoring
            ? activePath
              ? `Writing to ${activePath}`
              : "Recording in progress"
            : "Ready to record"}
        </Text>
      </HStack>

      {/* While the node is recording, the name is the node's, not this form's
          -- typing a different one would suggest it could be renamed
          mid-session. */}
      <HStack spacing={2}>
        {isStoring ? (
          <Input
            size="sm"
            aria-label="Project name"
            value={activeProject ?? "recording"}
            isReadOnly
            fontWeight="600"
          />
        ) : (
          <Input
            id="project_name"
            size="sm"
            aria-label="Project name"
            placeholder="Project name"
            {...register("project_name")}
          />
        )}
        <Tooltip
          label={
            !isAvailable
              ? "The storage node is not on the bus"
              : showsRecording
              ? "Stop the recording"
              : "Start recording"
          }
        >
          <Button
            type="submit"
            size="sm"
            flexShrink={0}
            minW="84px"
            colorScheme={showsRecording ? "red" : "teal"}
            variant={showsRecording ? "solid" : "outline"}
            leftIcon={<Icon as={showsRecording ? MdStop : MdFiberManualRecord} />}
            isLoading={isBusy}
            isDisabled={!transport || !isAvailable}
          >
            {showsRecording ? "Stop" : "Record"}
          </Button>
        </Tooltip>
      </HStack>

      <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2}>
        <Text fontSize="xs" fontWeight="600" color="text.secondary" mb={2}>
          Record
        </Text>
        {/* Read once, when the recorder's datasets are created, so they cannot
            be changed on a running session. */}
        <SimpleGrid minChildWidth="120px" spacingX={3} spacingY={2}>
          {OPTIONS.map(({ key, label }) => (
            <HStack key={key} spacing={2}>
              <Switch size="sm" id={key} isDisabled={isStoring} {...register(key)} />
              <Text as="label" htmlFor={key} fontSize="xs">
                {label}
              </Text>
            </HStack>
          ))}
        </SimpleGrid>

        {/* Nothing reads the energy off the RHEED gun, so the recording keeps
            what is said here -- and a pattern cannot be indexed without it. */}
        <VStack align="stretch" spacing="1px" mt={3} maxW="200px">
          <Text as="label" htmlFor="rheed_energy_kev" fontSize="0.65rem" color="text.muted">
            RHEED beam energy
          </Text>
          <InputGroup size="xs">
            <Input
              id="rheed_energy_kev"
              type="number"
              step="0.5"
              min={0}
              max={200}
              placeholder="lab default"
              isDisabled={isStoring}
              isInvalid={energyInvalid}
              {...register("rheed_energy_kev")}
            />
            <InputRightAddon>keV</InputRightAddon>
          </InputGroup>
        </VStack>

        {/* Who and why go into the file itself (v2), so a recording found later
            says who ran it without growth.db. Fixed once recording starts. */}
        {!isStoring && (
          <VStack align="stretch" spacing={2} mt={3}>
            <VStack align="stretch" spacing="1px" maxW="260px">
              <Text as="label" htmlFor="operator" fontSize="0.65rem" color="text.muted">
                Operator
              </Text>
              <Input
                id="operator"
                size="xs"
                placeholder={signedInAs ?? "Your name"}
                {...register("operator")}
              />
            </VStack>
            <VStack align="stretch" spacing="1px">
              <Text as="label" htmlFor="note" fontSize="0.65rem" color="text.muted">
                Note
              </Text>
              <Textarea
                id="note"
                size="xs"
                rows={2}
                resize="vertical"
                placeholder="What this growth is for, anything unusual"
                {...register("note")}
              />
            </VStack>
          </VStack>
        )}
      </Box>

      {isStoring ? (
        <LiveRecording summary={live} />
      ) : (
        isAvailable && <SavedWith missingDeps={missingDeps} context={driverProject} />
      )}

      {/* Storage records other nodes, so it can be up and still unable to save
          what you ticked. Better to see that before the growth than to find an
          empty dataset afterwards. */}
      {missingDeps.length > 0 && (
        <HStack
          spacing={2}
          align="flex-start"
          fontSize="xs"
          color="status.warn"
          borderWidth="1px"
          borderColor="status.warn"
          borderRadius="md"
          px={2}
          py={1}
        >
          <Icon as={MdWarningAmber} mt="2px" flexShrink={0} />
          <Text>
            {`Not on the bus: ${missingDeps.join(", ")} -- anything sourced from ${
              missingDeps.length > 1 ? "them" : "it"
            } cannot be recorded.`}
          </Text>
        </HStack>
      )}
    </VStack>
  );
};

/** What a recording keeps besides the data, greyed where its node is down. */
const SavedWith = ({ missingDeps, context }: { missingDeps: string[]; context: string | null }) => (
  <VStack align="stretch" spacing={1}>
    <Text fontSize="0.65rem" color="text.muted">
      Saved with the recording
    </Text>
    <Wrap spacing={1}>
      {["Operator and note", context ? `Driver session (${context})` : null]
        .filter((label): label is string => label !== null)
        .map((label) => (
          <WrapItem key={label}>
            <Badge variant="subtle" colorScheme="teal" fontSize="0.6rem" textTransform="none">
              {label}
            </Badge>
          </WrapItem>
        ))}
      {META_SOURCES.map(({ dep, label }) => {
        const down = missingDeps.includes(dep);
        return (
          <WrapItem key={label}>
            <Tooltip label={down ? `The ${dep} node is not on the bus` : undefined}>
              <Badge
                variant="subtle"
                colorScheme={down ? "gray" : "teal"}
                fontSize="0.6rem"
                textTransform="none"
                textDecoration={down ? "line-through" : undefined}
              >
                {label}
              </Badge>
            </Tooltip>
          </WrapItem>
        );
      })}
    </Wrap>
  </VStack>
);

/** Counts of the recording in progress, and a way to mark a moment in it. */
const LiveRecording = ({ summary }: { summary: RecordingSummary | null }) => {
  const transport = useTransportStore((s) => s.transport);
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const addNote = async () => {
    const message = text.trim();
    if (!transport || !message) return;
    setSending(true);
    try {
      const status = await new StorageStorageClient(transport).add_recording_event({
        kind: "note",
        message,
      });
      if (status.ok) setText("");
      else
        toast({ title: "Note not added", description: status.message, status: "warning", duration: 4000 });
    } catch (error) {
      toast({
        title: "Note not added",
        description: error instanceof Error ? error.message : String(error),
        status: "error",
        duration: 4000,
      });
    } finally {
      setSending(false);
    }
  };

  const counts = summary
    ? [
        [summary.n_frames, "frames"],
        [summary.n_log_rows, "log rows"],
        [summary.n_integrations, "integrations"],
        [summary.n_detections, "detections"],
        [summary.n_events, "events"],
      ]
        .filter(([n]) => n != null)
        .map(([n, label]) => `${(n as number).toLocaleString()} ${label}`)
    : [];

  return (
    <VStack align="stretch" spacing={2} borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2}>
      <Text fontSize="xs" fontWeight="600" color="text.secondary">
        This recording
      </Text>
      {summary ? (
        <>
          <Text fontSize="xs" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {[...counts, formatMb(summary.size_bytes)].join(" · ")}
          </Text>
          {(summary.operator || summary.note) && (
            <Text fontSize="xs" color="text.muted" noOfLines={2} title={summary.note ?? undefined}>
              {[summary.operator, summary.note].filter(Boolean).join(" — ")}
            </Text>
          )}
        </>
      ) : (
        <Text fontSize="xs" color="text.muted">
          Counts appear once the file can be read.
        </Text>
      )}
      <HStack spacing={2}>
        <Input
          size="xs"
          aria-label="Note to add to the recording"
          placeholder="Add a note at this moment"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter would otherwise submit the panel's form -- and stop the recording.
            if (e.key === "Enter") {
              e.preventDefault();
              void addNote();
            }
          }}
        />
        <Button
          type="button"
          size="xs"
          variant="outline"
          flexShrink={0}
          isLoading={sending}
          isDisabled={!text.trim()}
          onClick={() => void addNote()}
        >
          Add
        </Button>
      </HStack>
    </VStack>
  );
};

export default StorageMain;
