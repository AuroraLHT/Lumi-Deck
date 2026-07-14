import { AxiosInstance } from "axios";
import { DashboardSettings } from "../stores/dashboard";

/**
 * The full per-user settings blob stored by the backend.
 *
 * The backend treats this as opaque JSON -- the schema lives here, on the
 * frontend. Adding a key needs no backend change.
 */
export interface UserSettings {
  dashboard?: DashboardSettings;
  colorMode?: "light" | "dark";
}

interface SettingsEnvelope {
  settings: UserSettings;
}

export const fetchSettings = async (
  client: AxiosInstance
): Promise<UserSettings> => {
  const { data } = await client.get<SettingsEnvelope>("/users/me/settings");
  return data.settings ?? {};
};

export const saveSettings = async (
  client: AxiosInstance,
  settings: UserSettings
): Promise<UserSettings> => {
  const { data } = await client.put<SettingsEnvelope>("/users/me/settings", {
    settings,
  });
  return data.settings ?? {};
};

export const resetSettings = async (client: AxiosInstance): Promise<void> => {
  await client.delete("/users/me/settings");
};
