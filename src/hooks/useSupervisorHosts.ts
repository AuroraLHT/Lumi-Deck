import { useCallback, useEffect, useState } from "react";

import { HostInfo, SystemSupervisorClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";

/**
 * Hosts and their spawnable node types from the SystemSupervisor. Read-only
 * discovery for the "start a node" UI; the mutating spawn/kill/restart calls
 * live with the components that trigger them. `enabled` keeps a non-admin UI
 * from issuing the call at all.
 */
const useSupervisorHosts = (enabled: boolean) => {
  const transport = useTransportStore((s) => s.transport);

  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!transport || !enabled) return;
    setIsLoading(true);
    new SystemSupervisorClient(transport)
      .list_hosts()
      .then((list) => {
        setHosts(list.hosts ?? []);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err : new Error(String(err)))
      )
      .finally(() => setIsLoading(false));
  }, [transport, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { hosts, isLoading, error, refresh };
};

export default useSupervisorHosts;
