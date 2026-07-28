import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import {
  Badge,
  Button,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";

import useHTTPClient from "../../clients/http";
import useAuthStore from "../../stores/auth";
import {
  AccountUser,
  changePassword,
  createUser,
  listUsers,
} from "../../clients/accounts";

const ROLE_SCHEME: Record<string, string> = {
  admin: "cyan",
  operator: "purple",
  viewer: "gray",
  node: "orange",
};

/** Pull FastAPI's `{ detail }` out of an axios error, else a fallback. */
const detailOf = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
};

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

const ChangePasswordSection = () => {
  const client = useHTTPClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    defaultValues: { current: "", next: "", confirm: "" },
  });

  const onSubmit = async (values: PasswordForm) => {
    try {
      await changePassword(client, values.current, values.next);
      toast({
        title: "Password changed",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      reset();
    } catch (err) {
      toast({
        title: "Could not change password",
        description: detailOf(err, "Please try again."),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <VStack align="stretch" spacing={3}>
        <Heading size="sm">Change password</Heading>

        <FormControl isInvalid={!!errors.current}>
          <FormLabel fontSize="sm">Current password</FormLabel>
          <Input
            type="password"
            autoComplete="current-password"
            {...register("current", { required: "Required" })}
          />
          <FormErrorMessage>{errors.current?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.next}>
          <FormLabel fontSize="sm">New password</FormLabel>
          <Input
            type="password"
            autoComplete="new-password"
            {...register("next", {
              required: "Required",
              minLength: { value: 8, message: "At least 8 characters" },
            })}
          />
          <FormErrorMessage>{errors.next?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.confirm}>
          <FormLabel fontSize="sm">Confirm new password</FormLabel>
          <Input
            type="password"
            autoComplete="new-password"
            {...register("confirm", {
              required: "Required",
              validate: (val) =>
                val === watch("next") || "Passwords do not match",
            })}
          />
          <FormErrorMessage>{errors.confirm?.message}</FormErrorMessage>
        </FormControl>

        <Button
          type="submit"
          colorScheme="cyan"
          size="sm"
          alignSelf="flex-start"
          isLoading={isSubmitting}
          loadingText="Saving"
        >
          Update password
        </Button>
      </VStack>
    </form>
  );
};

interface NewUserForm {
  username: string;
  full_name: string;
  password: string;
  role: "viewer" | "operator" | "admin";
}

const UserManagementSection = () => {
  const client = useHTTPClient();
  const toast = useToast();

  const [users, setUsers] = useState<AccountUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoadError(null);
    listUsers(client)
      .then(setUsers)
      .catch((err) => setLoadError(detailOf(err, "Could not load users.")));
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewUserForm>({
    defaultValues: { username: "", full_name: "", password: "", role: "viewer" },
  });

  const onCreate = async (values: NewUserForm) => {
    try {
      await createUser(client, values);
      toast({
        title: `Created ${values.username}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      reset();
      refresh();
    } catch (err) {
      toast({
        title: "Could not create user",
        description: detailOf(err, "Please try again."),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Heading size="sm">Users</Heading>

      {loadError ? (
        <Text fontSize="sm" color="status.error">
          {loadError}
        </Text>
      ) : users === null ? (
        <Spinner size="sm" />
      ) : (
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Username</Th>
              <Th>Name</Th>
              <Th>Role</Th>
            </Tr>
          </Thead>
          <Tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>{u.username}</Td>
                <Td>{u.full_name || "—"}</Td>
                <Td>
                  <Badge colorScheme={ROLE_SCHEME[u.role] ?? "gray"}>
                    {u.role}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Divider />

      <form onSubmit={handleSubmit(onCreate)} noValidate>
        <VStack align="stretch" spacing={3}>
          <Heading size="xs" color="text.secondary">
            Create user
          </Heading>

          <FormControl isInvalid={!!errors.username}>
            <FormLabel fontSize="sm">Username</FormLabel>
            <Input
              autoComplete="off"
              {...register("username", { required: "Required" })}
            />
            <FormErrorMessage>{errors.username?.message}</FormErrorMessage>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Full name</FormLabel>
            <Input autoComplete="off" {...register("full_name")} />
          </FormControl>

          <FormControl isInvalid={!!errors.password}>
            <FormLabel fontSize="sm">Password</FormLabel>
            <Input
              type="password"
              autoComplete="new-password"
              {...register("password", {
                required: "Required",
                minLength: { value: 8, message: "At least 8 characters" },
              })}
            />
            <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="sm">Role</FormLabel>
            <Select {...register("role")}>
              <option value="viewer">viewer</option>
              <option value="operator">operator</option>
              <option value="admin">admin</option>
            </Select>
          </FormControl>

          <Button
            type="submit"
            colorScheme="cyan"
            size="sm"
            alignSelf="flex-start"
            isLoading={isSubmitting}
            loadingText="Creating"
          >
            Create user
          </Button>
        </VStack>
      </form>
    </VStack>
  );
};

const AccountModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || Boolean(user?.is_admin);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="panel.bg">
        <ModalHeader>Account</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={6}>
            <ChangePasswordSection />
            {isAdmin && (
              <>
                <Divider />
                <UserManagementSection />
              </>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AccountModal;
