import axios from "axios";
import useAuthStore, { User } from "../stores/auth";

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export class LoginError extends Error {}

/**
 * Exchange credentials for a token and store the resulting session.
 *
 * `host` is passed explicitly rather than read from the app store because the
 * user picks the host on the login screen, before any store is populated.
 */
export const login = async (
  host: string,
  username: string,
  password: string
): Promise<User> => {
  if (!host) {
    throw new LoginError("Select a server before signing in.");
  }

  // The API uses the OAuth2 password-form shape, so this is form-encoded and
  // not JSON.
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  try {
    const { data } = await axios.post<LoginResponse>(
      `http://${host}/auth/login`,
      form,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      }
    );

    useAuthStore
      .getState()
      .setSession(data.access_token, data.user, data.expires_in);

    return data.user;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new LoginError("Incorrect username or password.");
      }
      if (error.code === "ECONNABORTED") {
        throw new LoginError(`${host} did not respond. Is the server running?`);
      }
      if (!error.response) {
        throw new LoginError(
          `Could not reach ${host}. Check the address and that the server allows this origin.`
        );
      }
      throw new LoginError(
        error.response.data?.detail ?? "Sign-in failed. Please try again."
      );
    }
    throw new LoginError("Sign-in failed. Please try again.");
  }
};

export const logout = () => {
  useAuthStore.getState().logout();
};
