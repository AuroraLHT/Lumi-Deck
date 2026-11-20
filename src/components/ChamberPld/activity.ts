import { PldActivity } from "../../generated/lumi";

/** The agent calls through the MCP server, which names it `mcp:<user>`. */
export const isAgent = (actor: string | null | undefined) => Boolean(actor?.startsWith("mcp:"));

/** "Agent (hliang16)" for the agent, the user's name for a Deck user, "unknown" when the caller said nothing. */
export const actorLabel = (actor: string | null | undefined) =>
  !actor ? "unknown" : isAgent(actor) ? `Agent (${actor.slice(4)})` : actor;

/** The RHEED gun's ops: what the gun panel's "Last action" line and the agent toasts follow. */
export const RHEED_GUN_OPS = new Set([
  "rheed_filament_on",
  "rheed_filament_off",
  "rheed_hv_on",
  "rheed_hv_off",
  "set_rheed_filament",
  "set_rheed_hv",
  "set_rheed_focus",
  "set_rheed_deflection",
  "rheed_all_off_gentle",
  "rheed_all_off",
]);

const OP_LABELS: Record<string, string> = {
  rheed_filament_on: "RHEED filament on",
  rheed_filament_off: "RHEED filament off",
  rheed_hv_on: "RHEED HV on",
  rheed_hv_off: "RHEED HV off",
  set_rheed_filament: "RHEED filament set point",
  set_rheed_hv: "RHEED HV set point",
  set_rheed_focus: "RHEED focus",
  set_rheed_deflection: "RHEED deflection",
  rheed_all_off_gentle: "RHEED all off",
  rheed_all_off: "RHEED emergency off",
  acquire_control: "Acquire control",
  release_control: "Release control",
};

/** Request fields with a unit, as [prefix, unit], so `kv: 2` reads as "2 kV". */
const PARAM_UNITS: Record<string, [string, string]> = {
  ma: ["", "mA"],
  kv: ["", "kV"],
  x_ma: ["X ", "mA"],
  y_ma: ["Y ", "mA"],
  amps: ["", "A"],
  min_amps: ["min ", "A"],
  max_amps: ["max ", "A"],
  celsius: ["", "°C"],
  ramp_c_per_min: ["at ", "°C/min"],
  torr: ["", "Torr"],
  sccm: ["", "sccm"],
  min_sccm: ["min ", "sccm"],
  max_sccm: ["max ", "sccm"],
  mj: ["", "mJ"],
  rate_hz: ["at ", "Hz"],
  interval_s: ["every ", "s"],
};

/** Fields that say how to wait for the op, not what it does. */
const HIDDEN_PARAMS = new Set(["wait", "tolerance"]);

const paramText = (key: string, value: unknown) => {
  if (typeof value === "boolean") return `${key.replace(/_/g, " ")} ${value ? "yes" : "no"}`;
  const v = typeof value === "object" ? JSON.stringify(value) : String(value);
  const unit = PARAM_UNITS[key];
  return unit ? `${unit[0]}${v} ${unit[1]}` : `${key.replace(/_/g, " ")} ${v}`;
};

/** The op in words, with the request's set fields: "RHEED HV set point 2 kV". */
export const describeOp = (e: PldActivity) => {
  const label = OP_LABELS[e.op ?? ""] ?? (e.op ?? "op").replace(/_/g, " ");
  const params = Object.entries(e.params ?? {})
    .filter(([k, v]) => v != null && v !== "" && !HIDDEN_PARAMS.has(k))
    .map(([k, v]) => paramText(k, v));
  return params.length ? `${label} ${params.join(", ")}` : label;
};

/** "running", "ok · 0.4 s" or "refused" -- the outcome in a word or two. */
export const outcome = (e: PldActivity) =>
  e.running
    ? "running"
    : e.ok === false
    ? "refused"
    : e.duration_s != null && e.duration_s >= 0.05
    ? `ok · ${e.duration_s < 10 ? e.duration_s.toFixed(1) : Math.round(e.duration_s)} s`
    : "ok";

export const timeOfDay = (epochSeconds: number | undefined) =>
  epochSeconds == null ? "—" : new Date(epochSeconds * 1000).toLocaleTimeString();
