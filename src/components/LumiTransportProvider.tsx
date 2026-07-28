import { ReactNode, useEffect } from "react";

import useAppStore from "../stores/app";
import useAuthStore from "../stores/auth";
import useTransportStore from "../clients/transport";
import useChamberLogStream from "../hooks/useChamberLogStream";
import useAnalysisStreams from "../hooks/useAnalysisStreams";
import useDetectionStream from "../hooks/useDetectionStream";
import useNodeStates from "../hooks/useNodeStates";
import useSystemRegistryStream from "../hooks/useSystemRegistryStream";

/**
 * Connects the shared LumiTransport to the refactored backend bridge for the
 * currently selected host and session, mirroring MainWebsocketsProvider. The
 * transport reconnects with fresh credentials after a re-login because `token`
 * is an effect dependency.
 *
 * Capability streams whose cache must survive their panel being closed (and
 * which therefore need exactly one subscriber) are also started here.
 */
const LumiTransportProvider = ({ children }: { children: ReactNode }) => {
  const host = useAppStore((s) => s.selectedHost);
  const token = useAuthStore((s) => s.token);
  const connect = useTransportStore((s) => s.connect);
  const disconnect = useTransportStore((s) => s.disconnect);

  useSystemRegistryStream();
  useChamberLogStream();
  useAnalysisStreams();
  useDetectionStream();
  useNodeStates();

  useEffect(() => {
    // No host or session yet: nothing to connect to. withAuthToken reads the
    // live token, so `token` in the deps triggers a reconnect on re-login.
    if (!host || !token) {
      disconnect();
      return;
    }
    connect(host);
    return () => disconnect();
  }, [host, token, connect, disconnect]);

  return <>{children}</>;
};

export default LumiTransportProvider;
