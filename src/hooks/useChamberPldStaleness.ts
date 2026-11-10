import { useEffect, useState } from "react";

import useChamberPldNodeStore from "../stores/nodes/chamberPld";
import useChamberPldSeriesStore from "../stores/chamberPldSeries";

const STALE_AFTER_S = 5;

/**
 * Whether the chamber.pld state stream looks live right now. The service
 * pushes at ~2 Hz (`[pascal.pld] state_rate_hz`), so several seconds with no
 * new row means the stream or the service stopped, not that nothing changed
 * -- `connected: false` while disconnected confirms it, but the staleness
 * check also catches a stall this node hasn't noticed yet.
 */
const useChamberPldStaleness = () => {
  const connected = useChamberPldNodeStore((s) => s.state.connected);
  const readOnly = useChamberPldNodeStore((s) => s.state.read_only);
  const lastTime = useChamberPldSeriesStore((s) => s.rows[s.rows.length - 1]?.time ?? null);
  const [stale, setStale] = useState(true);

  useEffect(() => {
    if (lastTime == null) {
      setStale(true);
      return;
    }
    const check = () => setStale(Date.now() / 1000 - lastTime > STALE_AFTER_S);
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
  }, [lastTime]);

  return { stale, connected: Boolean(connected), readOnly: Boolean(readOnly) };
};

export default useChamberPldStaleness;
