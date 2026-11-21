import {
  Anneal,
  AutoAlignMaskCenter,
  BeginSetLaserPower,
  CoolDown,
  EndStorage,
  ExperimentDriverClient,
  FinishCurrentPixel,
  MoveMask,
  MoveTo,
  PerformDeposition,
  PerformPreablation,
  PixelIndex,
  RegisterSubstrate,
  ResumeSubstrate,
  RheedOn,
  SampleAngle,
  SetMfcControl,
  SetLaserEnergy,
  SetLaserHv,
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
import useExperimentDriverStore from "../../stores/experimentDriver";
import { MAX_FIRE_HZ } from "../ChamberPld/limits";
import { AUTO_ALIGN_KIND } from "./maskAlign";

export type OpCategory =
  | "Task"
  | "Heating laser"
  | "Excimer"
  | "RHEED gun"
  | "Motion"
  | "Gas & pressure"
  | "Target"
  | "Logging & storage"
  | "Substrate";

export const OP_CATEGORIES: OpCategory[] = [
  "Task",
  "Heating laser",
  "Excimer",
  "RHEED gun",
  "Motion",
  "Gas & pressure",
  "Target",
  "Logging & storage",
  "Substrate",
];

/** One live reading on an op's card; OpLiveContext renders each. */
export type Reading =
  | "temperature"
  | "heatingLaser"
  | "pid"
  | "excimer"
  | "excimerEnergy"
  | "excimerHv"
  | "excimerRange"
  | "confirmedPower"
  | "target"
  | "spin"
  | "twist"
  | "autoSpin"
  | "autoTwist"
  | "shutter"
  | "pressure"
  | "cdg"
  | "mfc"
  | "pressureControl"
  | "pressureSetpoint"
  | "mask"
  | "maskCalibration"
  | "rheedGun"
  | "sampleAngle"
  | "motorFree"
  | "pixel"
  | "substrate"
  | "project"
  | "growthLog"
  | "recording";

/** What a card shows unless its op names its own readings. */
export const CATEGORY_READINGS: Record<OpCategory, Reading[]> = {
  Task: ["target", "shutter", "mask", "excimerEnergy"],
  "Heating laser": ["temperature", "heatingLaser", "pid"],
  Excimer: ["excimer", "excimerEnergy", "excimerHv", "confirmedPower"],
  "RHEED gun": ["rheedGun"],
  Motion: ["mask", "rheedGun", "sampleAngle", "pixel", "motorFree"],
  "Gas & pressure": ["pressure", "cdg", "mfc", "pressureControl", "pressureSetpoint"],
  Target: ["target", "spin", "twist", "autoSpin", "autoTwist", "motorFree"],
  "Logging & storage": ["growthLog", "recording", "project"],
  Substrate: ["substrate", "pixel", "project"],
};

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
  /** Inclusive bounds for number and integer fields; outside them the field is invalid. */
  min?: number;
  max?: number;
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
  /** Live readings on the card; the category's when left out, none when empty. */
  readings?: Reading[];
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
  /** The stop button's confirm question, when the default (about pulses) does not fit. */
  stopConfirm?: string;
}

const stopDeposition = (c: ExperimentDriverClient) => c.stop_deposition({ reason: "operator stop" });
/** Ends whatever task runs; a heating task switches the PID off and holds the LD current. */
const cancelTask = (c: ExperimentDriverClient) => c.cancel_task({ reason: "operator stop" });
const HOLD = "PID goes off and the heater stays at its present current, so the temperature settles wherever that current puts it.";

const dryrun: FieldSpec = { key: "is_dryrun", label: "Dry run", type: "boolean", initial: false };

export const OP_REGISTRY: OpSpec[] = [
  // --- Task ------------------------------------------------------------------
  {
    id: "perform_preablation",
    startsTask: true,
    label: "Pre-ablation",
    category: "Task",
    hint: "Pulses left blank: the amount stored for the target's material.",
    fields: [
      { key: "target_id", label: "Target", type: "targets" },
      { key: "num_pulse", label: "Pulses", type: "integer", optional: true },
      { key: "frequency", label: "Rep rate", type: "number", unit: "Hz", initial: "10", max: MAX_FIRE_HZ },
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
    readings: ["target", "shutter", "mask", "excimerEnergy", "temperature", "pressure"],
    fields: [
      { key: "target_id", label: "Target", type: "targets" },
      { key: "num_pulse", label: "Pulses", type: "integer" },
      { key: "laser_repetition_rate", label: "Rep rate", type: "number", unit: "Hz", max: MAX_FIRE_HZ },
      dryrun,
    ],
    run: (c, p) => c.perform_deposition(p as unknown as PerformDeposition),
    stop: stopDeposition,
  },
  {
    id: "stop_deposition",
    label: "Stop deposition / pre-ablation",
    category: "Task",
    hint: "Ends the running deposition or pre-ablation and stops the laser. Harmless when nothing fires.",
    readings: ["excimer", "shutter"],
    fields: [{ key: "reason", label: "Reason", type: "text", optional: true, initial: "operator stop" }],
    run: (c, p) => c.stop_deposition(p as StopDeposition),
  },
  {
    id: AUTO_ALIGN_KIND,
    startsTask: true,
    // It may stop on a prompt for the marker, and the backend keeps one prompt at a time.
    opensPrompt: true,
    label: "Mask center auto-align",
    category: "Task",
    hint: "Scans Mask1 while watching the marker tagged mask-center on the chamber camera, then centers the slit on it. Scan around left blank: the current calibration.",
    readings: ["mask", "maskCalibration"],
    fields: [
      { key: "center_mm", label: "Scan around", type: "number", unit: "mm", step: 0.5, optional: true },
      { key: "half_window_mm", label: "Half-width", type: "number", unit: "± mm", step: 0.5, initial: "4" },
      { key: "apply", label: "Auto apply", type: "boolean", initial: true },
    ],
    run: (c, p) => c.auto_align_center_mask(p as AutoAlignMaskCenter),
    stop: cancelTask,
    stopConfirm: "Stop the alignment now?",
  },
  {
    id: "begin_check_mask_center",
    label: "Check mask center",
    category: "Task",
    hint: "Operator check: asks you to confirm the mask sits on its center.",
    opensPrompt: true,
    readings: ["mask", "maskCalibration"],
    fields: [],
    run: (c) => c.begin_check_mask_center(),
  },
  {
    id: "begin_align_center_mask",
    label: "Align mask by hand",
    category: "Task",
    hint: "Operator check: you step the mask onto center and confirm the position.",
    opensPrompt: true,
    readings: ["mask", "maskCalibration"],
    fields: [],
    run: (c) => c.begin_align_center_mask(),
  },
  {
    id: "begin_adjust_rheed_gain",
    label: "Tune RHEED gain",
    category: "Task",
    hint: "Operator check: adjust the RHEED camera gain, then confirm.",
    opensPrompt: true,
    readings: ["rheedGun"],
    fields: [],
    run: (c) => c.begin_adjust_rheed_gain(),
  },
  {
    id: "begin_check_rheed_pixels",
    label: "Check RHEED pixels",
    category: "Task",
    hint: "Operator check: steps through the substrate's pixels for you to confirm each one.",
    opensPrompt: true,
    readings: ["substrate", "pixel", "rheedGun"],
    fields: [],
    run: async (c) => {
      const status = await c.begin_check_rheed_pixels();
      // The prompt card reads the walk's position from here.
      useExperimentDriverStore.getState().setPixelStatus(status);
      return status.done
        ? { note: "No substrate positions to check -- register or resume a substrate first." }
        : status;
    },
  },

  // --- Heating laser ---------------------------------------------------------
  {
    id: "initiate_heating_laser",
    label: "Heating laser on",
    category: "Heating laser",
    fields: [],
    run: (c) => c.initiate_heating_laser(),
  },
  {
    id: "turn_off_heating_laser",
    label: "Heating laser off",
    category: "Heating laser",
    hint: "Refused above 165 °C -- cool down first. Force overrides.",
    fields: [{ key: "force", label: "Force", type: "boolean", initial: false }],
    run: (c, p) => c.turn_off_heating_laser(p as TurnOffHeatingLaser),
  },
  {
    id: "to_temperature",
    startsTask: true,
    label: "Ramp to temperature",
    category: "Heating laser",
    hint: "Needs the heating laser on first. Wait off: the task ends once the ramp is under way.",
    fields: [
      { key: "temperature", label: "Temperature", type: "number", unit: "°C" },
      { key: "ramp_rate", label: "Ramp rate", type: "number", unit: "°C/min", initial: "20" },
      { key: "wait", label: "Wait until arrived", type: "boolean", initial: true },
    ],
    run: (c, p) => c.to_temperature(p as unknown as ToTemperature),
    stop: cancelTask,
    stopConfirm: `Stop this ramp now? ${HOLD}`,
  },
  {
    id: "cool_down",
    startsTask: true,
    label: "Cool down",
    category: "Heating laser",
    fields: [{ key: "ramp_rate", label: "Ramp rate", type: "number", unit: "°C/min", initial: "20" }],
    run: (c, p) => c.cool_down(p as CoolDown),
    stop: cancelTask,
    stopConfirm: `Stop the cool-down now? ${HOLD}`,
  },
  {
    id: "anneal",
    startsTask: true,
    label: "Anneal",
    category: "Heating laser",
    hint: "Steps run in order: ramp to each temperature, then hold.",
    fields: [{ key: "steps", label: "Steps", type: "steps" }],
    run: (c, p) => c.anneal(p as unknown as Anneal),
    stop: cancelTask,
    stopConfirm: `Stop the anneal now? ${HOLD}`,
  },

  // --- Excimer ---------------------------------------------------------------
  {
    id: "set_laser_energy",
    label: "Set laser energy",
    category: "Excimer",
    hint: "Switches the excimer to energy mode (EGY PGR). Forgets the confirmed pulse energy -- run Laser energy check after. Refused while the laser fires or a deposition runs.",
    readings: ["excimer", "excimerEnergy", "excimerRange", "confirmedPower"],
    fields: [{ key: "mj", label: "Energy", type: "number", unit: "mJ", step: 0.5 }],
    run: (c, p) => c.set_laser_energy(p as unknown as SetLaserEnergy),
  },
  {
    id: "set_laser_hv",
    label: "Set laser HV",
    category: "Excimer",
    hint: "Switches the excimer to HV mode (HV PGR). Forgets the confirmed pulse energy -- run Laser energy check after. Refused while the laser fires or a deposition runs.",
    readings: ["excimer", "excimerHv", "excimerRange", "confirmedPower"],
    fields: [{ key: "kv", label: "HV", type: "number", unit: "kV", step: 0.01 }],
    run: (c, p) => c.set_laser_hv(p as unknown as SetLaserHv),
  },
  {
    id: "begin_set_laser_power",
    label: "Laser energy check",
    category: "Excimer",
    hint: "Under pld-service: sets energy mode at the wanted energy over today's laser test ratio, and is refused without a laser test today. Under the legacy driver: closes the shutter, turns the carousel to Clear, then asks for the pulse energy read off the meter at the exit port.",
    opensPrompt: true,
    fields: [
      { key: "laser_power", label: "Laser pulse energy", type: "number", unit: "mJ" },
      { key: "force", label: "Redo if already confirmed", type: "boolean", initial: false },
    ],
    run: (c, p) => c.begin_set_laser_power(p as unknown as BeginSetLaserPower),
  },
  // --- RHEED gun -------------------------------------------------------------
  {
    id: "rheed_on",
    label: "RHEED gun on",
    category: "RHEED gun",
    hint: "Filament on, HV on, then the emission search: the filament goes up in 50 mA steps until the emission saturates, then focus and deflection. Asked by a person (the lab's default), each step waits for you to say Up or Stop on the prompt. Blank fields use the lab's values; focus and deflection depend on the alignment. About 2-4 minutes from off.",
    // With a person deciding, it stops on a `rheed_emission` prompt.
    opensPrompt: true,
    fields: [
      { key: "hv_kv", label: "HV", type: "number", unit: "kV", step: 0.5, min: 0, optional: true },
      { key: "filament_start_ma", label: "Filament from", type: "number", unit: "mA", step: 50, min: 0, optional: true },
      { key: "filament_max_ma", label: "Filament at most", type: "number", unit: "mA", step: 50, min: 0, optional: true },
      { key: "focus_ma", label: "Focus", type: "number", unit: "mA", min: 0, optional: true },
      { key: "deflection_x_ma", label: "Deflection X", type: "number", unit: "mA", optional: true },
      { key: "deflection_y_ma", label: "Deflection Y", type: "number", unit: "mA", optional: true },
      {
        key: "by_person",
        label: "Saturation decided by",
        type: "select",
        optional: true,
        initial: "",
        options: [
          { value: "", label: "the lab's setting" },
          { value: "person", label: "a person, step by step" },
          { value: "rule", label: "the first-two-digits rule" },
        ],
      },
    ],
    run: (c, p) => {
      const { by_person, ...rest } = p;
      const req: RheedOn = { ...(rest as RheedOn) };
      if (by_person === "person") req.by_person = true;
      else if (by_person === "rule") req.by_person = false;
      return c.rheed_on(req);
    },
  },
  {
    id: "rheed_off",
    label: "RHEED gun off",
    category: "RHEED gun",
    hint: "HV and filament ramped off (gentle all off), about two minutes from full. Also ends an open emission search.",
    fields: [],
    run: (c) => c.rheed_off(),
  },

  // --- Motion ----------------------------------------------------------------
  {
    id: "move_mask_to_position",
    label: "Move mask",
    category: "Motion",
    hint: "Speed and ACC/DEC apply to this move only (pld-service caps them at 8.33 mm/s and 0.833 mm/s per ms); blank uses its default.",
    fields: [
      { key: "position", label: "Position", type: "number", unit: "mm", step: 0.1 },
      { key: "speed_mm_s", label: "Speed", type: "number", unit: "mm/s", step: 0.5, optional: true },
      { key: "accel_mm_s_per_ms", label: "ACC/DEC", type: "number", unit: "mm/s/ms", step: 0.05, optional: true },
    ],
    run: (c, p) => c.move_mask_to_position(p as unknown as MoveMask),
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
