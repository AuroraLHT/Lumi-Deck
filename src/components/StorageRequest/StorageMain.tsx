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
import { BaseResponseMessageHeader } from "../../entities/backend";

interface StorageFormValues {
  project_name: string;
  save_frame: boolean;
  save_ai: boolean;
  save_log: boolean;
  save_integration: boolean;
}

type StorageResponseMessage = {
  body: string;
  headers: BaseResponseMessageHeader;
}

const StorageMain: React.FC = () => {
  // TODO: should quote the isRecording by the storage node state
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
  const client = useHTTPClient();
  const toast = useToast();

  const onSubmit: SubmitHandler<StorageFormValues> = async (data) => {
    try {
      const endpoint = isRecording ? "/storage/end" : "/storage/start";
      const response = await client.post(endpoint, data);

      const responseData = response.data as StorageResponseMessage;
      
      const responseMessage = responseData.body;
      const responseHeaders = responseData.headers;
      
      // console.log(response);
      // console.log(responseHeaders);

      // console.log(responseHeaders.succ);
      if (responseHeaders.succ) {
        if (endpoint == "/storage/end") {
          setIsRecording(false);
        } else {
          setIsRecording(true);
        }

        toast({
          title: "Success",
          description: responseMessage,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
  
      } else {
        toast({
          title: responseHeaders.error_type,
          description: responseMessage,
          status: "warning",
          duration: 3000,
          isClosable: true,
        });

        if (responseHeaders.error_type == "StorageTerminationError") {
          setIsRecording(false);
        }
      }
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Error",
        description: "Failed to submit storage request. Check Network Connection.",
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
