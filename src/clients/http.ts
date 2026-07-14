import axios, { AxiosInstance } from "axios";
import { useMemo } from "react";
import useAppStore from "../stores/app";
import useAuthStore, { getAuthToken } from "../stores/auth";

/**
 * Build an axios instance pointed at the selected host, carrying the access
 * token and dropping the session when the API rejects it.
 */
export const createHTTPClient = (host: string): AxiosInstance => {
  const client = axios.create({
    baseURL: `http://${host}`,
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 10000,
    withCredentials: false,
  });

  // Read the token per-request rather than closing over it, so a client built
  // before login keeps working once the user signs in.
  client.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired or revoked server-side. Clear the session so the router
        // returns the user to the login page, rather than leaving them looking
        // at panels that silently fail to load.
        useAuthStore.getState().logout();
      }
      return Promise.reject(error);
    }
  );

  return client;
};

const useHTTPClient = (): AxiosInstance => {
  const selectedHost = useAppStore((s) => s.selectedHost);

  // Memoised because the previous version built a new axios instance on every
  // render, which makes the client unusable as a react-query dependency.
  return useMemo(() => createHTTPClient(selectedHost), [selectedHost]);
};

export default useHTTPClient;
