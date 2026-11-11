import {
  Anneal,
  BeginSetLaserPower,
  CoolDown,
  EndStorage,
  ExperimentDriverClient,
  FinishCurrentPixel,
  MoveTo,
  PerformDeposition,
  PerformPreablation,
  PixelIndex,
  RegisterSubstrate,
  ResumeSubstrate,
  SampleAngle,
  SetMfcControl,
  SetMfcFlow,
  SetPressure,
  SetPressureControl,
  SetTarget,
  StartMiLogging,
  StartStorage,
  StopDeposition,
  ToTemperature,
  TurnOffHeatingLaser,
} from "../../generated/lumi";

export type OpCategory =
  | "Task"
  | "Motion"
  | "Gas & pressure"
  | "Laser"
  | "Target"
  | "Logging & storage"
  | "Substrate";

export const OP_CATEGORIES: OpCategory[] = [
  "Task",
  "Motion",
  "Gas & pressure",
  "Laser",
  "Target",
  "Logging & storage",
  "Substrate",
];

export interface FieldSpec {
  key: string;
  label: string;
  /**
   * `targets` is a select filled live from `show_available_targets`;
   * `numberList` is comma-separated numbers; `steps` is anneal's step table.
   */
  type: "number" | "integer" | "text" | "boolean" | "select" | "targets" | "numberList" | "steps";
  unit?: string;
  step?: number;
  /** Blank leaves the field out of the request, so the backend default applies. */
  optional?: boolean;
  /** Prefilled with the backend's own default where it has one. */
  initial?: string | boolean;
  options?: { value: string; label: string }[];
  /** `targets` only: also offer Clear and Monitor, which can be selected but not ablated. */
  viewports?: boolean;
}

/** Every value is built from the field specs, so the cast in each `run` holds by construction. */
export type Payload = Record<string, unknown>;

export interface OpSpec {
  /** The client method name. */
  id: string;
  label: string;
  category: OpCategory;
  hint?: string;
  fields: FieldSpec[];
  /**
   * Opens a pending confirmation: blocked while one is open or a task runs,
   * since the backend keeps one at a time and a second replaces the first.
   */
  opensPrompt?: boolean;
  /** Starts a driver task: refused while another task runs, since the driver runs one at a time. */
  startsTask?: boolean;
  run: (client: ExperimentDriverClient, payload: Payload) => Promise<unknown>;
  /**
   * Ends this op's task while it runs. Only the ops the backend can stop
   * have one; the rest run to completion once started.
   */
  stop?: (client: ExperimentDriverClient) => Promise<unknown>;
}

const stopDeposition = (c: ExperimentDriverClient) => c.stop_deposition({ reason: "operator stop" });

const dryrun: FieldSpec = { key: "is_dryrun", label: "Dry run", type: "boolean", initial: false };

export const OP_REGISTRY: OpSpec[] = [
  // --- Task ------------------------------------------------------------------
  {
    id: "to_temperature",
    startsTask: true,
    label: "Ramp to temperature",
    category: "Task",
    hint: "Needs the heating laser on first. Wait off: the task ends once the ramp is under way.",
    fields: [
      { key: "temperature", label: "Temperature", type: "number", unit: "°C" },
      { key: "ramp_rate", label: "Ramp rate", type: "number", unit: "°C/min", initial: "20" },
      { key: "wait", label: "Wait until arrived", type: "boolean", initial: true },
    ],
    run: (c, p) => c.to_temperature(p as unknown as ToTemperature),
  },
  {
    id: "cool_down",
    startsTask: true,
    label: "Cool down",
    category: "Task",
    fields: [{ key: "ramp_rate", label: "Ramp rate", type: "number", unit: "°C/min", initial: "20" }],
    run: (c, p) => c.cool_down(p as CoolDown),
  },
  {
    id: "perform_preablation",
    startsTask: true,
    label: "Pre-ablation",
    category: "Task",
    fields: [
      { key: "target_id", label: "Target", type: "targets" },
      { key: "num_pulse", label: "Pulses", type: "integer", initial: "1000" },
      { key: "frequency", label: "Rep rate", type: "number", unit: "Hz", initial: "10" },
      { key: "move_mask_to_block_position", label: "Mask to block position", type: "boolean", initial: true },
      dryrun,
    ],
    run: (c, p) => c.perform_preablation(p as unknown as PerformPreablation),
    stop: stopDeposition,
  },
  {
    id: "perform_deposition",
    startsTask: true,
    label: "Deposition",
    category: "Task",
    fields: [
      { key: "target_id", label: "Target", type: "targets" },
      { key: "num_pulse", label: "Pulses", type: "integer" },
      { key: "laser_repetition_rate", label: "Rep rate", type: "number", unit: "Hz" },
      dryrun,
    ],
    run: (c, p) => c.perform_deposition(p as unknown as PerformDeposition),
    stop: stopDeposition,
  },
  {
    id: "anneal",
    startsTask: true,
    label: "Anneal",
    category: "Task",
    hint: "Steps run in order: ramp to each temperature, then hold.",
    fields: [{ key: "steps", label: "Steps", type: "steps" }],
    run: (c, p) => c.anneal(p as unknown as Anneal),
  },
  {
    id: "stop_deposition",
    label: "Stop deposition / pre-ablation",
    category: "Task",
    hint: "Ends the running deposition or pre-ablation and stops the laser. Harmless when nothing fires.",
    fields: [{ key: "reason", label: "Reason", type: "text", optional: true, initial: "operator stop" }],
    run: (c, p) => c.stop_deposition(p as StopDeposition),
  },

  // --- Motion ----------------------------------------------------------------
  {
    id: "move_mask_to_position",
    label: "Move mask",
    category: "Motion",
    fields: [{ key: "position", label: "Position", type: "number", unit: "mm", step: 0.1 }],
    run: (c, p) => c.move_mask_to_position(p as unknown as MoveTo),
  },
  {
    id: "move_rheed_to_position",
    label: "Move RHEED gun",
    category: "Motion",
    fields: [{ key: "position", label: "Position", type: "number", unit: "mm", step: 0.1 }],
    run: (c, p) => c.move_rheed_to_position(p as unknown as MoveTo),
  },
  {
    id: "rotate_sample_to",
    label: "Rotate sample to",
    category: "Motion",
    fields: [{ key: "angle", label: "Angle", type: "number", unit: "°" }],
    run: (c, p) => c.rotate_sample_to(p as unknown as SampleAngle),
  },
  {
    id: "rotate_sample_by",
    label: "Rotate sample by",
    category: "Motion",
    hint: "Signed: negative turns the other way.",
    fields: [{ key: "angle", label: "Delta", type: "number", unit: "°" }],
    run: (c, p) => c.rotate_sample_by(p as unknown as SampleAngle),
  },
  {
    id: "to_pixel",
    label: "Go to pixel",
    category: "Motion",
    hint: "Moves mask and RHEED gun to a pixel of the loaded substrate.",
    fields: [{ key: "index", label: "Pixel index", type: "integer" }],
    run: (c, p) => c.to_pixel(p as unknown as PixelIndex),
  },
  {
    id: "to_current_pixel",
    label: "Go to current pixel",
    category: "Motion",
    fields: [],
    run: (c) => c.to_current_pixel(),
  },

  // --- Gas & pressure --------------------------------------------------------
  {
    id: "set_mfc_flow",
    label: "Set MFC flow",
    category: "Gas & pressure",
    hint: "With pld-service the flow starts at once (there is no master gate).",
    fields: [
      { key: "mfc_id", label: "MFC", type: "select", options: [{ value: "1", label: "MFC1" }], initial: "1" },
      { key: "flow", label: "Flow", type: "number", unit: "sccm" },
    ],
    run: (c, p) => c.set_mfc_flow(p as unknown as SetMfcFlow),
  },
  {
    id: "set_mfc_control",
    label: "MFC master gate",
    category: "Gas & pressure",
    hint: "pld-service has no gate: off sets MFC1 to zero, on does nothing.",
    fields: [{ key: "enabled", label: "Enabled", type: "boolean", initial: true }],
    run: (c, p) => c.set_mfc_control(p as unknown as SetMfcControl),
  },
  {
    id: "set_pressure",
    label: "Set pressure setpoint",
    category: "Gas & pressure",
    hint: "≤ 2e-4 Torr runs the low regime, ≥ 3e-3 the high one; between is refused. Takes effect with pressure control on.",
    fields: [{ key: "pressure", label: "Pressure", type: "number", unit: "Torr", step: 0.0001 }],
    run: (c, p) => c.set_pressure(p as unknown as SetPressure),
  },
  {
    id: "set_pressure_control",
    label: "Pressure control on/off",
    category: "Gas & pressure",
    fields: [{ key: "on", label: "On", type: "boolean", initial: true }],
    run: (c, p) => c.set_pressure_control(p as unknown as SetPressureControl),
  },

  // --- Laser -----------------------------------------------------------------
  {
    id: "initiate_heating_laser",
    label: "Heating laser on",
    category: "Laser",
    fields: [],
    run: (c) => c.initiate_heating_laser(),
  },
  {
    id: "turn_off_heating_laser",
    label: "Heating laser off",
    category: "Laser",
    hint: "Refused above 165 °C -- cool down first. Force overrides.",
    fields: [{ key: "force", label: "Force", type: "boolean", initial: false }],
    run: (c, p) => c.turn_off_heating_laser(p as TurnOffHeatingLaser),
  },
  {
    id: "begin_set_laser_power",
    label: "Laser energy check",
    category: "Laser",
    hint: "Closes the shutter, turns the carousel to Clear, then asks for the meter reading.",
    opensPrompt: true,
    fields: [
      { key: "laser_power", label: "Laser power", type: "number", unit: "mJ" },
      { key: "force", label: "Redo if already confirmed", type: "boolean", initial: false },
    ],
    run: (c, p) => c.begin_set_laser_power(p as unknown as BeginSetLaserPower),
  },

  // --- Target ----------------------------------------------------------------
  {
    id: "set_target",
    label: "Select target",
    category: "Target",
    hint: "Revolves the carousel and sets rotation and twist to AUTO.",
    fields: [{ key: "target_id", label: "Target", type: "targets", viewports: true }],
    run: (c, p) => c.set_target(p as unknown as SetTarget),
  },

  // --- Logging & storage -----------------------------------------------------
  {
    id: "start_mi_logging",
    label: "Start growth log",
    category: "Logging & storage",
    hint: "The chamber node's log of the service state. 1 s for a growth.",
    fields: [
      { key: "interval_s", label: "Interval", type: "integer", unit: "s", initial: "1" },
      { key: "file_name", label: "File name", type: "text", optional: true },
    ],
    run: (c, p) => c.start_mi_logging(p as StartMiLogging),
  },
  {
    id: "stop_mi_logging",
    label: "Stop growth log",
    category: "Logging & storage",
    fields: [],
    run: (c) => c.stop_mi_logging(),
  },
  {
    id: "start_storage",
    label: "Start recording",
    category: "Logging & storage",
    fields: [
      { key: "project_name", label: "Project", type: "text" },
      { key: "save_frame", label: "Frames", type: "boolean", initial: true },
      { key: "save_ai", label: "AI results", type: "boolean", initial: true },
      { key: "save_log", label: "Chamber log", type: "boolean", initial: true },
      { key: "save_integration", label: "Integrations", type: "boolean", initial: true },
      { key: "force_rewrite", label: "Overwrite existing", type: "boolean", initial: false },
      { key: "rheed_energy_kev", label: "RHEED energy", type: "number", unit: "keV", optional: true },
      dryrun,
    ],
    run: (c, p) => c.start_storage(p as unknown as StartStorage),
  },
  {
    id: "end_storage",
    label: "Stop recording",
    category: "Logging & storage",
    fields: [dryrun],
    run: (c, p) => c.end_storage(p as EndStorage),
  },

  // --- Substrate -------------------------------------------------------------
  {
    id: "register_substrate",
    label: "Register substrate",
    category: "Substrate",
    hint: "Give pixel spacing or explicit positions, not both.",
    fields: [
      { key: "substrate_name", label: "Name", type: "text", optional: true },
      { key: "materials", label: "Material", type: "text", optional: true },
      { key: "orientation", label: "Orientation", type: "text", optional: true },
      { key: "width", label: "Width", type: "number", unit: "mm", optional: true },
      { key: "height", label: "Height", type: "number", unit: "mm", optional: true },
      { key: "thickness", label: "Thickness", type: "number", optional: true },
      { key: "pixel_spacing", label: "Pixel spacing", type: "number", unit: "mm", optional: true },
      { key: "positions", label: "Positions", type: "numberList", unit: "mm, comma-separated", optional: true },
      { key: "manufacturer", label: "Manufacturer", type: "text", optional: true },
      { key: "manufacture_date", label: "Manufacture date", type: "text", optional: true },
    ],
    run: (c, p) => c.register_substrate(p as RegisterSubstrate),
  },
  {
    id: "resume_substrate",
    label: "Resume substrate",
    category: "Substrate",
    fields: [{ key: "substrate_id", label: "Substrate id", type: "integer" }],
    run: (c, p) => c.resume_substrate(p as unknown as ResumeSubstrate),
  },
  {
    id: "finish_current_pixel",
    label: "Finish current pixel",
    category: "Substrate",
    fields: [
      { key: "material", label: "Material grown", type: "text", optional: true },
      { key: "thickness", label: "Thickness", type: "number", optional: true },
    ],
    run: (c, p) => c.finish_current_pixel(p as FinishCurrentPixel),
  },
  {
    id: "finish_substrate",
    label: "Finish substrate",
    category: "Substrate",
    fields: [],
    run: (c) => c.finish_substrate(),
  },
  {
    id: "unload_substrate",
    label: "Unload substrate",
    category: "Substrate",
    hint: "Takes it off the chamber without touching the database.",
    fields: [],
    run: (c) => c.unload_substrate(),
  },
];
