import axios from "axios";
import { httpOrigin, isSecureHost, tailscaleHostHint } from "../stores/app";
import useAuthStore, { User } from "../stores/auth";

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export class LoginError extends Error {
  /**
   * Set when the host is `https://` and the request failed with no response
   * at all -- the shape a rejected/untrusted certificate takes in the browser
   * (indistinguishable from a DNS failure or an unreachable host, since
   * fetch/XHR never exposes *why* a TLS handshake failed). `healthUrl` is an
   * unauthenticated endpoint the user can open directly to see and accept the
   * certificate warning once, then come back and retry.
   */
  readonly certLikely: boolean;
  readonly healthUrl?: string;

  constructor(
    message: string,
    opts?: { certLikely?: boolean; healthUrl?: string }
  ) {
    super(message);
    this.certLikely = opts?.certLikely ?? false;
    this.healthUrl = opts?.healthUrl;
  }
}

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
      `${httpOrigin(host)}/auth/login`,
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
        if (isSecureHost(host)) {
          throw new LoginError(
            `Could not reach ${host}. If its certificate isn't trusted in ` +
              `this browser yet, open its health check below and accept the ` +
              `warning, then retry -- or use ${tailscaleHostHint()}, which ` +
              `needs no click-through.`,
            { certLikely: true, healthUrl: `${httpOrigin(host)}/health` }
          );
        }
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
