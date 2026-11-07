import { create } from "zustand";

import { PldChamberState, PldEvent } from "../generated/lumi";

const MAX_EVENTS = 200;

interface ChamberPldState {
  /** The latest poll of the chamber, pushed on the `chamber.pld` `state` stream. */
  chamber: PldChamberState | null;
  /** Most recent first, from polling `recent_events` -- the service keeps no push channel for these. */
  events: PldEvent[];

  setChamber: (chamber: PldChamberState) => void;
  setEvents: (events: PldEvent[]) => void;
  reset: () => void;
}

const useChamberPldStore = create<ChamberPldState>((set) => ({
  chamber: null,
  events: [],

  setChamber: (chamber) => set({ chamber }),

  // The service hands back oldest-first, capped; keep newest-first for display
  // and cap again client-side so a long-open tab does not grow this forever.
  setEvents: (events) =>
    set({ events: [...events].reverse().slice(0, MAX_EVENTS) }),

  reset: () => set({ chamber: null, events: [] }),
}));

export default useChamberPldStore;
