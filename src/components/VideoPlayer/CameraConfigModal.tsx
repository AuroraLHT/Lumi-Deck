import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  FormErrorMessage,
} from "@chakra-ui/react";
import useRHEEDStore from "../../clients/rheed";
import { useForm } from "react-hook-form";
import { useEffect } from "react";

export interface CameraConfigModalProps {
  isCameraConfig: boolean;
  setIsCameraConfig: (isOpen: boolean) => void;
}

export interface CameraConfigForm {
  exposure_time: number;
  gain: number;
}

const CameraConfigModal = ({
  isCameraConfig,
  setIsCameraConfig,
}: CameraConfigModalProps) => {
  const cameraConfig = useRHEEDStore((s) => s.cameraConfig);
  const requestCameraConfigUpdate = useRHEEDStore(
    (s) => s.requestCameraConfigUpdate
  );
  const requestCameraConfig = useRHEEDStore((s) => s.requestCameraConfig);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<CameraConfigForm>({
    defaultValues: cameraConfig,
  });

  useEffect(() => {
    if (isCameraConfig) {
    //   console.log("requesting camera config");
      requestCameraConfig();
    }
  }, [isCameraConfig, requestCameraConfig]);

  useEffect(() => {
    // console.log("camera config updated", cameraConfig);
    reset(cameraConfig);
  }, [cameraConfig, reset]);

  const onSubmit = (data: CameraConfigForm) => {
    // console.log("updating camera config", data);
    requestCameraConfigUpdate(data);
    // setIsCameraConfig(false);
  };

  return (
    <Modal isOpen={isCameraConfig} onClose={() => setIsCameraConfig(false)}>
      {/* <ModalOverlay /> */}
      <ModalContent>
        <ModalHeader>Camera Configuration</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4}>
              <FormControl isInvalid={!!errors.exposure_time}>
                <FormLabel>Exposure Time (μs)</FormLabel>
                <Input
                  type="number"
                  placeholder="Enter exposure time"
                  {...register("exposure_time", {
                    required: "Exposure time is required",
                    valueAsNumber: true,
                    min: {
                      value: 0,
                      message: "Exposure time must be positive",
                    },
                  })}
                />
                <FormErrorMessage>
                  {errors.exposure_time && errors.exposure_time.message}
                </FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.gain}>
                <FormLabel>Gain</FormLabel>
                <Input
                  type="number"
                  placeholder="Enter gain value (0-240)"
                  {...register("gain", {
                    required: "Gain is required",
                    valueAsNumber: true,
                    min: {
                      value: 0,
                      message: "Gain must be positive",
                    },
                    max: {
                      value: 240,
                      message: "Gain must be less than 240",
                    },
                  })}
                />
                <FormErrorMessage>
                  {errors.gain && errors.gain.message}
                </FormErrorMessage>
              </FormControl>

              <Button type="submit" colorScheme="blue" mr={3}>
                Save Changes
              </Button>
            </VStack>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CameraConfigModal;
