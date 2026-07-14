import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuEye, LuEyeOff } from "react-icons/lu";

import { LoginError, login } from "../../clients/auth";
import useAppStore, { DEFAULT_HOSTS } from "../../stores/app";

interface LoginForm {
  host: string;
  username: string;
  password: string;
}

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedHost = useAppStore((s) => s.selectedHost);
  const setSelectedHost = useAppStore((s) => s.setSelectedHost);
  const customHosts = useAppStore((s) => s.customHosts);

  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: {
      host: selectedHost || DEFAULT_HOSTS[0],
      username: "",
      password: "",
    },
  });

  const hosts = [...DEFAULT_HOSTS, ...customHosts];

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      // Commit the host before the request so that, on success, every store and
      // socket that reads `selectedHost` is already pointed at the right server.
      setSelectedHost(values.host);
      await login(values.host, values.username, values.password);

      // Send the user back to wherever they were headed before the redirect.
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof LoginError
          ? error.message
          : "Sign-in failed. Please try again."
      );
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="app.bg" p={4}>
      {/* Ambient glow: a hint of the RHEED phosphor behind the card. */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w={{ base: "320px", md: "560px" }}
        h={{ base: "320px", md: "560px" }}
        borderRadius="full"
        bg="accent.solid"
        opacity={0.07}
        filter="blur(90px)"
        pointerEvents="none"
      />

      <Box
        position="relative"
        w="100%"
        maxW="400px"
        bg="panel.bg"
        border="1px solid"
        borderColor="panel.border"
        borderRadius="2xl"
        boxShadow="2xl"
        p={{ base: 6, md: 8 }}
      >
        <VStack align="stretch" spacing={6}>
          <VStack align="stretch" spacing={1}>
            <HStack spacing={2}>
              <Box w="10px" h="10px" borderRadius="full" bg="accent.solid" />
              <Text
                fontSize="xs"
                fontWeight="700"
                letterSpacing="0.18em"
                textTransform="uppercase"
                color="text.secondary"
              >
                Lumi Control
              </Text>
            </HStack>
            <Heading size="lg" letterSpacing="-0.02em">
              Sign in
            </Heading>
            <Text fontSize="sm" color="text.muted">
              Autonomous PLD / RHEED console
            </Text>
          </VStack>

          {formError && (
            <Alert status="error" borderRadius="lg" fontSize="sm">
              <AlertIcon />
              {formError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <VStack align="stretch" spacing={4}>
              <FormControl isInvalid={!!errors.host}>
                <FormLabel fontSize="sm">Server</FormLabel>
                <Select
                  {...register("host", { required: "Select a server" })}
                  autoComplete="off"
                >
                  {hosts.map((host) => (
                    <option key={host} value={host}>
                      {host}
                    </option>
                  ))}
                </Select>
                <FormErrorMessage>{errors.host?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.username}>
                <FormLabel fontSize="sm">Username</FormLabel>
                <Input
                  {...register("username", { required: "Username is required" })}
                  autoComplete="username"
                  autoFocus
                />
                <FormErrorMessage>{errors.username?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.password}>
                <FormLabel fontSize="sm">Password</FormLabel>
                <InputGroup>
                  <Input
                    {...register("password", {
                      required: "Password is required",
                    })}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                  />
                  <InputRightElement>
                    <Button
                      variant="panelGhost"
                      size="sm"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      tabIndex={-1}
                    >
                      <Icon as={showPassword ? LuEyeOff : LuEye} />
                    </Button>
                  </InputRightElement>
                </InputGroup>
                <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                colorScheme="cyan"
                isLoading={isSubmitting}
                loadingText="Signing in"
                w="100%"
                mt={2}
              >
                Sign in
              </Button>
            </VStack>
          </form>
        </VStack>
      </Box>
    </Flex>
  );
};

export default LoginPage;
