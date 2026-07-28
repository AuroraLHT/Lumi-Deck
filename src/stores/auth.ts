import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: number;
  username: string;
  full_name: string;
  is_admin: boolean;
  /**
   * Backend authorization role carried in the login response and the JWT the
   * `/ws` bridge gates on. Optional so sessions persisted before the field
   * existed still deserialize; callers fall back to `is_admin`.
   */
  role?: "viewer" | "operator" | "admin" | "node";
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** Unix ms at which the token stops being accepted by the API. */
  expiresAt: number | null;

  setSession: (token: string, user: User, expiresInSeconds: number) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      expiresAt: null,

      setSession: (token, user, expiresInSeconds) =>
        set({
          token,
          user,
          expiresAt: Date.now() + expiresInSeconds * 1000,
        }),

      logout: () => set({ token: null, user: null, expiresAt: null }),

      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token) return false;
        // Treat a locally-expired token as logged out so we show the login page
        // instead of firing a round of requests that will all 401.
        if (expiresAt !== null && Date.now() >= expiresAt) return false;
        return true;
      },
    }),
    {
      name: "lumi-auth",
      // Deliberately excludes nothing: the token must survive a page reload,
      // which means localStorage and therefore XSS exposure. See AUTH.md.
    }
  )
);

/**
 * Read the token outside of React (websocket stores, axios interceptors).
 * Returns null when the token is missing or has expired.
 */
export const getAuthToken = (): string | null => {
  const state = useAuthStore.getState();
  return state.isAuthenticated() ? state.token : null;
};

/**
 * Append the access token to a URL as a query parameter.
 *
 * EventSource, WebSocket and <img> cannot send an Authorization header, so the
 * API also accepts `?token=`. Returns an empty string for a falsy input so
 * callers can pass a not-yet-known host without special-casing it.
 */
export const withAuthToken = (url: string): string => {
  if (!url) return "";

  const token = getAuthToken();
  if (!token) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};

export default useAuthStore;
