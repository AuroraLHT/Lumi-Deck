import React, { useEffect, useState } from "react";
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

interface StorageFormValues {
  project_name: string;
  save_frame: boolean;
  save_ai: boolean;
  save_log: boolean;
  save_integration: boolean;
}

const StorageMain: React.FC = () => {
  const { register, handleSubmit } = useForm<StorageFormValues>(
    {
      defaultValues: {
        save_frame: true,
        save_ai: true,
        save_log: true,
        save_integration: true,
      }
    }
  );
  const [isRecording, setIsRecording] = useState(false);
  const { isOpen, onToggle } = useDisclosure();
  const transport = useTransportStore((s) => s.transport);
  const toast = useToast();

  // Recording is server-side state: a session started before this tab was opened
  // is still running, so the button has to reflect the node rather than assume
  // "not recording" on mount.
  useEffect(() => {
    if (!transport) return;
    let cancelled = false;
    new StorageStorageClient(transport)
      .getState()
      .then((state) => {
        if (!cancelled) setIsRecording(state.is_storing ?? false);
      })
      .catch((err) => console.error("Storage getState failed:", err));
    return () => {
      cancelled = true;
    };
  }, [transport]);

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
    try {
      const status = isRecording
        ? await client.stop_recording()
        : await client.start_recording(data);

      if (status.ok) {
        setIsRecording(!isRecording);
        toast({
          title: "Success",
          description: status.message ?? (isRecording ? "Recording stopped" : "Recording started"),
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: isRecording ? "Could not stop recording" : "Could not start recording",
          description: status.message,
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
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
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // console.log("StorageMain rendered");

  return (
    <Box pt={2}>
      <form id="storageForm" onSubmit={handleSubmit(onSubmit)}>
        <FormControl>
          <Flex alignItems="center" justifyContent="space-between">
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
            <FormLabel htmlFor="project_name" mb="0" flexShrink={0}>Project Name:</FormLabel>
            <Input
              id="project_name"
              placeholder="Project Name"
              {...register("project_name")}
              maxWidth={["100%", "300px"]}
            />

            <CircularButton
                type="submit"
                aria-label={isRecording ? "Stop" : "Start"}
                // icon={<Icon as={isRecording ? MdStop : MdFiberManualRecord} />}
                icon={isRecording ? <MdStop /> : <MdFiberManualRecord />}
                // icon={<MdFiberManualRecord />}

                fontSize={"1rem"}
                colorScheme={isRecording ? "red" : "teal"}
                size="sm"
            />
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

                  <Checkbox id="save_frame" {...register("save_frame")}>
                    Frame
                  </Checkbox>

                  <Checkbox id="save_ai" {...register("save_ai")}>
                    Detection
                  </Checkbox>

                  <Checkbox id="save_log" {...register("save_log")}>
                    Log
                  </Checkbox>

                  <Checkbox id="save_integration" {...register("save_integration")}>
                    Integration
                  </Checkbox>

                </Stack>
              </CheckboxGroup>
            </Box>
          </Collapse>
        </FormControl>
      </form>
    </Box>
  );
};

export default StorageMain;
