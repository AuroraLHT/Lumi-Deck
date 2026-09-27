import { StepInfo } from "../../generated/lumi";

/** Epoch seconds -> "Sep 24, 15:49:46", in the viewer's time zone. */
export const formatTime = (sec: number | null | undefined, withDate = true) =>
  sec == null
    ? "--"
    : new Date(sec * 1000).toLocaleString(undefined, {
        ...(withDate ? { month: "short", day: "numeric" } : {}),
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

export const formatDay = (sec: number) =>
  new Date(sec * 1000).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  if (seconds < 1) return "<1s";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${rest}s`;
  return `${rest}s`;
};

/** `perform_deposition` -> "Perform deposition". */
export const stepLabel = (kind: string) => {
  const words = kind.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A recording some step of this sample made: `start_storage` names it. */
export interface SampleRecording {
  name: string;
  startedAt: number;
  /** The deposition it recorded, when one ran while it was open. */
  deposition: StepInfo | null;
}

/**
 * The recordings a sample's journal points at. `start_storage` puts the file
 * stem in its result as `storage_name` -- the same name `storage.archive`
 * lists it under. A dry run, or a start that failed, recorded nothing.
 */
export const recordingsOf = (steps: StepInfo[]): SampleRecording[] => {
  const out: SampleRecording[] = [];
  steps.forEach((step, i) => {
    if (step.kind !== "start_storage" || step.ok === false) return;
    const name = step.result?.storage_name;
    if (typeof name !== "string" || !name || step.params?.is_dryrun === true) return;
    // The deposition is the one between this start and the next end_storage.
    let deposition: StepInfo | null = null;
    for (const later of steps.slice(i + 1)) {
      if (later.kind === "end_storage" || later.kind === "start_storage") break;
      if (later.kind === "perform_deposition") deposition = later;
    }
    out.push({ name, startedAt: step.started_at ?? 0, deposition });
  });
  return out;
};

/** Index of the frame recorded closest to `time` (frame_times is ascending). */
export const nearestFrame = (frameTimes: number[], time: number) => {
  let lo = 0;
  let hi = frameTimes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frameTimes[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && time - frameTimes[lo - 1] < frameTimes[lo] - time) return lo - 1;
  return lo;
};

/** First step start to last step end: when this sample was in the chamber being worked on. */
export const stepSpan = (steps: StepInfo[]): [number, number] | null => {
  const starts = steps.map((s) => s.started_at).filter((t): t is number => t != null);
  if (!starts.length) return null;
  const ends = steps.map((s) => s.ended_at ?? s.started_at).filter((t): t is number => t != null);
  return [Math.min(...starts), Math.max(...ends)];
};

/** Sample state -> Chakra colour scheme for its badge. */
export const STATE_SCHEME: Record<string, string> = {
  grown: "green",
  active: "blue",
  planned: "gray",
  retired: "red",
};

/** A quiet gap longer than this starts a new working session in the journal. */
const SESSION_GAP_S = 60 * 60;

export interface WorkSession {
  start: number;
  end: number;
  steps: StepInfo[];
}

/**
 * The journal split into stretches of work. A sample grown in layers over
 * several days would otherwise ask the chamber log for days of rows, most of
 * them an idle chamber, and thin them down until the growth is a few pixels.
 */
export const sessionsOf = (steps: StepInfo[]): WorkSession[] => {
  const sessions: WorkSession[] = [];
  for (const step of steps) {
    const start = step.started_at;
    if (start == null) continue;
    const end = step.ended_at ?? start;
    const last = sessions[sessions.length - 1];
    if (last && start - last.end <= SESSION_GAP_S) {
      last.steps.push(step);
      last.end = Math.max(last.end, end);
    } else {
      sessions.push({ start, end, steps: [step] });
    }
  }
  return sessions;
};
