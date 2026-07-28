import { create } from "zustand";

import { LogEntry } from "../generated/lumi";

/**
 * The rolling chamber log cache the Monitor charts plot from.
 *
 * The backend's `chamber.log` capability emits a `LogEntry` per row, whose
 * `values` are keyed by the chamber's CSV column names ("Time", "Vac Pres Main",
 * "HT Temp moni", ...). That map is exactly the legacy `Log` shape the charts
 * already index, so the entries are flattened to it on the way in and the chart
 * components need no changes.
 *
 * `LogEntry.time` / `time_stamp` are not populated by the node -- the row's own
 * "Time" column is the authoritative timestamp, and that is what the charts use.
 */
export type Log = { [key: string]: string };
export type Logs = Log[];

const DEFAULT_MAX_CACHE_SIZE = 1000;

interface ChamberLogState {
  logs: Logs;
  recentLog: Log;
  maxLogCacheSize: number;

  setMaxLogCacheSize: (maxLogCacheSize: number) => void;
  appendEntries: (entries: LogEntry[]) => void;
  reset: () => void;
}

/** Charts call `parseFloat`/`new Date` on every field, so normalise to strings. */
const toLog = (entry: LogEntry): Log => {
  const log: Log = {};
  for (const [column, value] of Object.entries(entry.values)) {
    log[column] = value === null ? "" : String(value);
  }
  return log;
};

const useChamberLogStore = create<ChamberLogState>((set) => ({
  logs: [],
  recentLog: {},
  maxLogCacheSize: DEFAULT_MAX_CACHE_SIZE,

  setMaxLogCacheSize: (maxLogCacheSize) =>
    set((state) => ({
      maxLogCacheSize,
      // Shrinking the window must drop the oldest rows immediately, otherwise
      // the cache stays over budget until the next entry arrives.
      logs:
        state.logs.length > maxLogCacheSize
          ? state.logs.slice(state.logs.length - maxLogCacheSize)
          : state.logs,
    })),

  appendEntries: (entries) =>
    set((state) => {
      if (entries.length === 0) return state;
      const rows = entries.map(toLog);
      const merged = state.logs.concat(rows);
      const overflow = merged.length - state.maxLogCacheSize;
      return {
        logs: overflow > 0 ? merged.slice(overflow) : merged,
        recentLog: rows[rows.length - 1],
      };
    }),

  reset: () => set({ logs: [], recentLog: {} }),
}));

export default useChamberLogStore;
