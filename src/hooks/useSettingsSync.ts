import { useCallback, useEffect, useRef, useState } from "react";
import { useColorMode } from "@chakra-ui/react";

import useHTTPClient from "../clients/http";
import { UserSettings, fetchSettings, saveSettings } from "../clients/settings";
import useAppStore from "../stores/app";
import useAuthStore from "../stores/auth";
import useDashboardStore from "../stores/dashboard";

const SAVE_DEBOUNCE_MS = 900;

export type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

/**
 * Loads the user's settings from the backend once they are signed in, then
 * writes changes back, debounced.
 *
 * Mounted once, near the root. Dragging a panel fires a layout change per
 * animation frame, so saving on every change would hammer the API -- hence the
 * debounce, and hence only saving once `hydrated` is true (otherwise the
 * default layout would immediately overwrite the user's saved one on load).
 */
const useSettingsSync = () => {
  const client = useHTTPClient();
  const token = useAuthStore((s) => s.token);
  const host = useAppStore((s) => s.selectedHost);

  const { colorMode, setColorMode } = useColorMode();

  const panels = useDashboardStore((s) => s.panels);
  const layouts = useDashboardStore((s) => s.layouts);
  const hydrated = useDashboardStore((s) => s.hydrated);
  const hydrate = useDashboardStore((s) => s.hydrate);
  const toSettings = useDashboardStore((s) => s.toSettings);

  const [status, setStatus] = useState<SyncStatus>("idle");

  const timerRef = useRef<number | null>(null);
  // Guards the first save: applying fetched settings changes `colorMode`, which
  // would otherwise look like a user edit and trigger a redundant PUT.
  const justHydratedRef = useRef(false);

  // ---- load -------------------------------------------------------------

  useEffect(() => {
    if (!token || !host) return;

    let cancelled = false;
    setStatus("loading");

    fetchSettings(client)
      .then((settings) => {
        if (cancelled) return;

        justHydratedRef.current = true;
        hydrate(settings.dashboard ?? null);

        if (settings.colorMode && settings.colorMode !== colorMode) {
          setColorMode(settings.colorMode);
        }

        setStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to the defaults already in the store. A failed load must not
        // block the dashboard -- the operator can still run the chamber.
        hydrate(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [client, token, host]);

  // ---- save -------------------------------------------------------------

  const flush = useCallback(async () => {
    const payload: UserSettings = {
      dashboard: toSettings(),
      colorMode: colorMode as "light" | "dark",
    };

    setStatus("saving");
    try {
      await saveSettings(client, payload);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [client, colorMode, toSettings]);

  useEffect(() => {
    if (!hydrated || !token || !host) return;

    if (justHydratedRef.current) {
      justHydratedRef.current = false;
      return;
    }

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [panels, layouts, colorMode, hydrated, token, host, flush]);

  return { status, flush };
};

export default useSettingsSync;
