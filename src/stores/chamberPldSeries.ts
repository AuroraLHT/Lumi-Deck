import { create } from "zustand";

import { PldChamberState } from "../generated/lumi";

/**
 * The scalar fields the Monitor charts plot, flattened from each
 * `PldChamberState` push (~2 Hz) the same way `chamberLog` flattens log rows --
 * one row per tick, each chart maps out whichever fields it needs at render.
 *
 * Nulls are gaps, not zeros: the service itself reports null when a reading
 * is not meaningful (pyrometer below range, a filament still warming up), and
 * that is passed through here unchanged rather than coerced to 0 the way the
 * CSV log has to.
 */
export interface PldSeriesRow {
  /** Epoch seconds -- the poll cycle this row came from, not when it arrived here. */
  time: number;
  heater_temperature: number | null;
  /** Null when the PID is off: the setpoint field then reflects whatever it was last set to, not a live target. */
  heater_temperature_setpoint: number | null;
  pressures_ig1: number | null;
  pressures_cdg10: number | null;
  pressures_cdg11: number | null;
  pressures_ig3: number | null;
  pressures_tcg31: number | null;
  /** tcg[0] -- "Back Pres Main" (TCG1, DP1's foreline). Unconfirmed above its 1.00E-04 floor. */
  pressures_tcg0: number | null;
  laser_pulses_fired: number | null;
  laser_missed_shots: number | null;
  laser_pulses_requested: number | null;
  /** Null unless the current/last train is actively firing -- rate_hz persists after a train ends and would otherwise plot a flat line with no "firing" meaning. */
  laser_rate_hz: number | null;
}

const MAX_ROWS = 3600; // 30 min at the service's 2 Hz state_rate_hz

/** `state.time` is when the pld-service's own poll cycle finished, not `Date.now()`. */
export const toSeriesRow = (state: PldChamberState): PldSeriesRow => ({
  time: state.time ?? Date.now() / 1000,
  heater_temperature: state.heater?.temperature ?? null,
  heater_temperature_setpoint: state.heater?.pid_on ? state.heater?.temperature_setpoint ?? null : null,
  // ig1_on/ig3_on false means the filament is off, not that the last reading
  // is stale -- nulled here so the chart does not plot a frozen pre-off value.
  pressures_ig1: state.pressures?.ig1_on ? state.pressures?.ig1 ?? null : null,
  pressures_cdg10: state.pressures?.cdg10 ?? null,
  pressures_cdg11: state.pressures?.cdg11 ?? null,
  pressures_ig3: state.pressures?.ig3_on ? state.pressures?.ig3 ?? null : null,
  pressures_tcg31: state.pressures?.tcg31 ?? null,
  pressures_tcg0: state.pressures?.tcg?.[0] ?? null,
  laser_pulses_fired: state.laser?.pulses_fired ?? null,
  laser_missed_shots: state.laser?.missed_shots ?? null,
  laser_pulses_requested: state.laser?.pulses_requested ?? null,
  laser_rate_hz: state.laser?.status === "firing" ? state.laser?.rate_hz ?? null : null,
});

interface ChamberPldSeriesState {
  rows: PldSeriesRow[];
  appendRow: (row: PldSeriesRow) => void;
  reset: () => void;
}

const useChamberPldSeriesStore = create<ChamberPldSeriesState>((set) => ({
  rows: [],

  appendRow: (row) =>
    set((state) => {
      const rows = state.rows.concat(row);
      const overflow = rows.length - MAX_ROWS;
      return { rows: overflow > 0 ? rows.slice(overflow) : rows };
    }),

  reset: () => set({ rows: [] }),
}));

export default useChamberPldSeriesStore;
