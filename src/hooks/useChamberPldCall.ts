import { useCallback, useState } from "react";

import { ChamberPldClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useChamberPldStore from "../stores/chamberPld";
import { errorText, useCanOperate } from "./useDriverCall";

export { useCanOperate };

/**
 * Runs one chamber.pld op from a control panel.
 *
 * Unlike the experiment driver, most pld ops answer {ok, message} rather than
 * throwing -- a refusal (no control, an interlock, read-only hardware, ...) is
 * a normal reply, so `run` only catches transport-level failures into `error`;
 * callers read `ok`/`message` off their own result to show per-control feedback.
 *
 * Re-fetches `chamber_state()` after every call rather than waiting on the
 * push stream: many setters (motion, gas, excimer, ...) do not reliably push a
 * state update right away, and a control that goes quiet after a click reads
 * as broken.
 */
const useChamberPldCall = () => {
  const transport = useTransportStore((s) => s.transport);
  const canOperate = useCanOperate();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(op: (client: ChamberPldClient) => Promise<T>): Promise<T | undefined> => {
      if (!transport) return undefined;
      setBusy(true);
      setError(null);
      try {
        return await op(new ChamberPldClient(transport));
      } catch (err) {
        setError(errorText(err));
        return undefined;
      } finally {
        setBusy(false);
        new ChamberPldClient(transport)
          .chamber_state()
          .then((state) => useChamberPldStore.getState().setChamber(state))
          .catch(() => {});
      }
    },
    [transport]
  );

  return { run, busy, error, setError, canOperate };
};

export default useChamberPldCall;
