import { MIExecution } from "../../generated/lumi";

/**
 * How an execution should read on screen.
 *
 * `MIExecution.state` is `MIState.name` on the backend (`pascal/mi_mode.py`), so
 * the values that actually appear are IDLE, LOAD, LOADED, RUNNING, COMPLETED and
 * ABORTED -- names, not the enum's file-prefix values ("Completed", "Running").
 * Anything else is passed through rather than hidden, so a backend that grows a
 * state does not silently render as blank.
 *
 * The flags outrank the state name. An execution that was `$stop`ped keeps
 * whatever state it had reached, and `is_stopped` is the only thing that says it
 * was cut short -- so it is checked first.
 */
export interface ExecutionDisplay {
  label: string;
  /** Semantic token or Chakra colour, used for the badge and the status dot. */
  color: string;
  /** True while the chamber is actively working on this script. */
  isActive: boolean;
  isFinished: boolean;
  /** Tooltip text, where the label alone would be read as more than it means. */
  hint?: string;
}

export const describeExecution = (execution: MIExecution): ExecutionDisplay => {
  if (execution.is_stopped) {
    return { label: "Stopped", color: "orange.400", isActive: false, isFinished: true };
  }
  if (execution.is_aborted) {
    return { label: "Aborted", color: "status.error", isActive: false, isFinished: true };
  }

  switch (execution.state) {
    case "RUNNING":
      return {
        label: "Running",
        color: "status.ok",
        isActive: true,
        isFinished: false,
        hint: "PASCAL is working through the script's lines.",
      };
    case "LOAD":
      return { label: "Loading", color: "status.warn", isActive: true, isFinished: false };
    case "LOADED":
      return { label: "Loaded", color: "status.warn", isActive: true, isFinished: false };
    case "IDLE":
      // Not "doing nothing" -- IDLE is the state an execution is created in and
      // keeps until the MI thread picks it up off the queue.
      return { label: "Queued", color: "status.idle", isActive: false, isFinished: false };
    case "COMPLETED":
      // NOT "Completed". PASCAL reports Completed when it has finished *reading*
      // the script, and the setpoint commands do not block: `Temperature Set`
      // returns as soon as the setpoint is accepted (`pascal/sim/runner.py:103`),
      // so a ten-minute ramp shows up here one second after it was submitted.
      // Whether the chamber arrived is a chamber-log question, not an MI one --
      // "Script done" is the widest claim this state actually supports.
      return {
        label: "Script done",
        color: "status.ok",
        isActive: false,
        isFinished: true,
        hint:
          "PASCAL finished the script. Setpoints it wrote (temperature, pressure) " +
          "keep converging after this -- the chamber log is what shows that.",
      };
    case "ABORTED":
      return { label: "Aborted", color: "status.error", isActive: false, isFinished: true };
    default:
      return {
        label: execution.state || "Unknown",
        color: "status.idle",
        isActive: false,
        isFinished: Boolean(execution.is_execution_finished),
      };
  }
};

/** First non-empty line of a script, for the one-line summary in the list. */
export const summarizeCommands = (commands: string): string => {
  const firstLine = commands
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? "(empty script)";
};

/** MI uuids are full v4s; the head is enough to tell two runs apart. */
export const shortUuid = (uuid: string): string =>
  uuid.length > 8 ? uuid.slice(0, 8) : uuid || "-";
