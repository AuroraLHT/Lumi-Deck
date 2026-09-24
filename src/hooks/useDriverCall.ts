import { useCallback, useState } from "react";

import { ExperimentDriverClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useAuthStore from "../stores/auth";
import { refreshDriverState } from "./useExperimentDriverStream";

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Runs one experiment-driver op from a panel control.
 *
 * Every op the panel calls is MUTATE, which the backend only accepts from an
 * operator or admin, so `canOperate` is exposed for the UI to disable
 * controls up front rather than let a viewer click into a rejection.
 *
 * After each call the state is re-read, not left to the stream: the ops that
 * open or close a gate do push an event, but `set_rheed_gain` and friends do
 * not, and a control that went quiet after a click reads as a dead button.
 */
const useDriverCall = () => {
  const transport = useTransportStore((s) => s.transport);
  const user = useAuthStore((s) => s.user);
  const canOperate =
    user?.role === "operator" || user?.role === "admin" || Boolean(user?.is_admin);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(op: (client: ExperimentDriverClient) => Promise<T>): Promise<T | undefined> => {
      if (!transport) return undefined;
      setBusy(true);
      setError(null);
      try {
        return await op(new ExperimentDriverClient(transport));
      } catch (err) {
        setError(errorText(err));
        return undefined;
      } finally {
        setBusy(false);
        refreshDriverState(transport).catch(() => {});
      }
    },
    [transport]
  );

  return { run, busy, error, setError, canOperate };
};

export default useDriverCall;
