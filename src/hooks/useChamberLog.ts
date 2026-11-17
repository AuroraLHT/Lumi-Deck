import useChamberLogStore, { Log, Logs } from "../stores/chamberLog";

export type { Log, Logs };

/**
 * Reads the chamber log cache. The rows are put there by `useChamberLogStream`,
 * which owns the single `chamber.log` subscription over the shared transport.
 */
const NO_LOGS: Logs = [];

/**
 * `enabled` false subscribes to nothing, so a chart plotting the chamber.pld
 * stream instead doesn't re-render on every chamber.log message.
 */
const useLog = (enabled = true) => {
  const logs = useChamberLogStore((s) => (enabled ? s.logs : NO_LOGS));
  const recentLog = useChamberLogStore((s) => (enabled ? s.recentLog : null));
  return { recentLog, logs };
};

export default useLog;
