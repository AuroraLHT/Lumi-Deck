import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Checkbox,
  FormControl,
  FormLabel,
  Icon,
  IconButton,
  Input,
  Stack,
  Collapse,
  CheckboxGroup,
  Flex,
  Text,
  Tooltip,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useForm, SubmitHandler } from "react-hook-form";
import {
  MdExpandLess,
  MdExpandMore,
  MdFiberManualRecord,
  MdStop,
} from "react-icons/md";
import CircularButton from "../VideoPlayer/CircularButton";
import { StorageStorageClient } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useStorageNodeStore from "../../stores/nodes/storage";

interface StorageFormValues {
  project_name: string;
  save_frame: boolean;
  save_ai: boolean;
  save_log: boolean;
  save_integration: boolean;
}

/**
 * How long to keep the button busy waiting for the node to confirm.
 *
 * The RPC returning ok=true is not the same as the node reporting is_storing:
 * the flag arrives on the next heartbeat, up to ~2s later. Without a ceiling a
 * node that answers and then dies would leave the button disabled forever.
 */
const CONFIRM_TIMEOUT_MS = 8000;

const StorageMain: React.FC = () => {
  const { register, handleSubmit } = useForm<StorageFormValues>({
    defaultValues: {
      save_frame: true,
      save_ai: true,
      save_log: true,
      save_integration: true,
    },
  });
  const { isOpen, onToggle } = useDisclosure();
  const transport = useTransportStore((s) => s.transport);
  const toast = useToast();

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
        : await client.start_recording(data);

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

  return (
    <Box pt={2}>
      <form id="storageForm" onSubmit={handleSubmit(onSubmit)}>
        <FormControl>
          <Flex alignItems="center" justifyContent="space-between" gap={2}>
            <IconButton
              aria-label="Toggle options"
              icon={
                isOpen ? <Icon as={MdExpandLess} /> : <Icon as={MdExpandMore} />
              }
              onClick={onToggle}
              variant="outline"
              size="sm"
              borderWidth="0"
            />
            <FormLabel htmlFor="project_name" mb="0" flexShrink={0}>
              Project Name:
            </FormLabel>

            {/* While the node is recording, the name is the node's, not this
                form's -- typing a different one would suggest it could be
                renamed mid-session, and would hide which file is being written
                when the session was started somewhere else. */}
            {isStoring ? (
              <Tooltip label={activePath ?? "Recording in progress"}>
                <Flex
                  alignItems="center"
                  gap={2}
                  minW={0}
                  maxWidth={["100%", "300px"]}
                  flex="1"
                >
                  <Box
                    w="8px"
                    h="8px"
                    borderRadius="full"
                    bg="red.400"
                    flexShrink={0}
                  />
                  <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                    {activeProject ?? "recording"}
                  </Text>
                </Flex>
              </Tooltip>
            ) : (
              <Input
                id="project_name"
                placeholder="Project Name"
                {...register("project_name")}
                maxWidth={["100%", "300px"]}
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
              <Box>
                <CircularButton
                  type="submit"
                  aria-label={showsRecording ? "Stop" : "Start"}
                  icon={showsRecording ? <MdStop /> : <MdFiberManualRecord />}
                  fontSize={"1rem"}
                  colorScheme={showsRecording ? "red" : "teal"}
                  size="sm"
                  isLoading={isBusy}
                  isDisabled={!transport || !isAvailable}
                />
              </Box>
            </Tooltip>
          </Flex>

          <Collapse in={isOpen} animateOpacity>
            <Box
              bg="panel.bgElevated"
              color="text.primary"
              borderWidth="1px"
              borderColor="panel.border"
              boxShadow="md"
              p={4}
              borderRadius="md"
            >
              <CheckboxGroup colorScheme="green">
                <Stack spacing={[1, 5]} direction={["column", "row"]}>
                  <FormLabel htmlFor="save_frame">Options:</FormLabel>

                  {/* These are read once, when the recorder's datasets are
                      created, so they cannot be changed on a running session. */}
                  <Checkbox
                    id="save_frame"
                    isDisabled={isStoring}
                    {...register("save_frame")}
                  >
                    Frame
                  </Checkbox>

                  <Checkbox
                    id="save_ai"
                    isDisabled={isStoring}
                    {...register("save_ai")}
                  >
                    Detection
                  </Checkbox>

                  <Checkbox
                    id="save_log"
                    isDisabled={isStoring}
                    {...register("save_log")}
                  >
                    Log
                  </Checkbox>

                  <Checkbox
                    id="save_integration"
                    isDisabled={isStoring}
                    {...register("save_integration")}
                  >
                    Integration
                  </Checkbox>
                </Stack>
              </CheckboxGroup>

              {/* Storage records other nodes, so it can be up and still unable
                  to save what you ticked. Better to see that before the growth
                  than to find an empty dataset afterwards. */}
              {missingDeps.length > 0 && (
                <Text fontSize="xs" color="orange.400" mt={3}>
                  {`Not on the bus: ${missingDeps.join(", ")} — anything sourced from ${
                    missingDeps.length > 1 ? "them" : "it"
                  } cannot be recorded.`}
                </Text>
              )}

              {isStoring && activePath && (
                <Text fontSize="xs" color="text.secondary" mt={3} noOfLines={1}>
                  {`Writing to ${activePath}`}
                </Text>
              )}
            </Box>
          </Collapse>
        </FormControl>
      </form>
    </Box>
  );
};

export default StorageMain;
