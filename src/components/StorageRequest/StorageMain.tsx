import React, { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Icon,
  IconButton,
  Input,
  Stack,
  HStack,
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
import useHTTPClient from "../../clients/http";

interface StorageFormValues {
  project_name: string;
  save_frame: boolean;
  save_ai: boolean;
  save_log: boolean;
}

const StorageMain: React.FC = () => {
  const { register, handleSubmit } = useForm<StorageFormValues>();
  const [isRecording, setIsRecording] = useState(false);
  const { isOpen, onToggle } = useDisclosure();
  const client = useHTTPClient();
  const toast = useToast();

  const onSubmit: SubmitHandler<StorageFormValues> = async (data) => {
    try {
      const endpoint = isRecording ? "/storage/end" : "/storage/start";
      const response = await client.post(endpoint, data);

      console.log(response.data);
      setIsRecording(!isRecording);

      toast({
        title: "Success",
        description: "Storage request submitted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Failed to submit storage request",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  console.log("StorageMain rendered");

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
            <Box bg="gray.100" p={4} borderRadius="md">
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
