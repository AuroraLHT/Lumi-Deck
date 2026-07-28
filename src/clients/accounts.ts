import { AxiosInstance } from "axios";

import { User } from "../stores/auth";

/**
 * Account-management endpoints added when auth was ported onto the contract-nodes
 * bridge. All are plain HTTP (the axios client from useHTTPClient), sitting beside
 * the `/ws` bridge. `role` is always present on these responses.
 */
export type AccountUser = User & { role: NonNullable<User["role"]> };

export interface CreateUserInput {
  username: string;
  password: string;
  full_name?: string;
  role: "viewer" | "operator" | "admin";
}

/** Change the signed-in user's own password. Backend requires >= 8 chars. */
export const changePassword = async (
  client: AxiosInstance,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await client.post("/auth/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
};

/** Admin only: list all accounts. */
export const listUsers = async (
  client: AxiosInstance
): Promise<AccountUser[]> => {
  const { data } = await client.get<AccountUser[]>("/auth/users");
  return data;
};

/** Admin only: create an account. */
export const createUser = async (
  client: AxiosInstance,
  input: CreateUserInput
): Promise<AccountUser> => {
  const { data } = await client.post<AccountUser>("/auth/users", input);
  return data;
};
