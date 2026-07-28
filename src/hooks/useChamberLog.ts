import useChamberLogStore, { Log, Logs } from "../stores/chamberLog";

export type { Log, Logs };

/**
 * Reads the chamber log cache. The rows are put there by `useChamberLogStream`,
 * which owns the single `chamber.log` subscription over the shared transport.
 */
const useLog = () => {
  const logs = useChamberLogStore((s) => s.logs);
  const recentLog = useChamberLogStore((s) => s.recentLog);
  return { recentLog, logs };
};

export default useLog;
