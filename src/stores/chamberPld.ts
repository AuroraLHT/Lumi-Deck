import { create } from "zustand";

import { PldActivity, PldChamberState, PldEvent } from "../generated/lumi";

const MAX_EVENTS = 200;
const MAX_ACTIVITY = 300;

interface ChamberPldState {
  /** The latest poll of the chamber, pushed on the `chamber.pld` `state` stream. */
  chamber: PldChamberState | null;
  /** Most recent first, from polling `recent_events` -- the service keeps no push channel for these. */
  events: PldEvent[];
  /**
   * The chamber.pld ops the node handled -- who asked, what, and the answer --
   * newest first. Seeded from `recent_activity`, then kept current from the
   * newest ten that ride on every state push.
   */
  activity: PldActivity[];
  /** The largest seq merged so far; 0 before the seed. */
  activitySeq: number;
  /** The seed from `recent_activity` has come back (possibly empty): later entries are news. */
  activityLoaded: boolean;

  setChamber: (chamber: PldChamberState) => void;
  setEvents: (events: PldEvent[]) => void;
  /** Adds entries, replacing any with the same seq (a running op arrives again once it ends). */
  mergeActivity: (entries: PldActivity[]) => void;
  setActivityLoaded: () => void;
  reset: () => void;
}

const useChamberPldStore = create<ChamberPldState>((set) => ({
  chamber: null,
  events: [],
  activity: [],
  activitySeq: 0,
  activityLoaded: false,

  setChamber: (chamber) => set({ chamber }),

  // The service hands back oldest-first, capped; keep newest-first for display
  // and cap again client-side so a long-open tab does not grow this forever.
  setEvents: (events) =>
    set({ events: [...events].reverse().slice(0, MAX_EVENTS) }),

  mergeActivity: (entries) =>
    set((s) => {
      if (!entries.length) return s;
      const bySeq = new Map(s.activity.map((e) => [e.seq, e]));
      for (const e of entries) if (e.seq != null) bySeq.set(e.seq, e);
      const activity = [...bySeq.values()].sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0)).slice(0, MAX_ACTIVITY);
      return { activity, activitySeq: Math.max(s.activitySeq, activity[0]?.seq ?? 0) };
    }),

  setActivityLoaded: () => set({ activityLoaded: true }),

  reset: () => set({ chamber: null, events: [], activity: [], activitySeq: 0, activityLoaded: false }),
}));

export default useChamberPldStore;
