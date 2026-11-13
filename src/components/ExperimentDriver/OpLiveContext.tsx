import { ReactNode } from "react";
import { Box, SimpleGrid, Text } from "@chakra-ui/react";

import useChamberPldStore from "../../stores/chamberPld";
import useChamberPldNodeStore from "../../stores/nodes/chamberPld";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import { BoolBadge, Field, TruncatedText, fmt, fmtTorr } from "../ChamberPld/primitives";
import { CATEGORY_READINGS, OpSpec, Reading } from "./opRegistry";

const txt = (v: ReactNode) => <Text fontSize="xs">{v}</Text>;

/**
 * The readings an operator needs while filling in the selected op, read from
 * the streams the app already holds (chamber.pld's state push, the driver's
 * own state) -- nothing is polled for this.
 */
const OpLiveContext = ({ op }: { op: OpSpec }) => {
  const chamber = useChamberPldStore((s) => s.chamber);
  const pldNode = useChamberPldNodeStore((s) => s.state);
  const driver = useExperimentDriverNodeStore((s) => s.state);

  const heater = chamber?.heater;
  const motion = chamber?.motion;
  const gas = chamber?.gas;
  const pressures = chamber?.pressures;
  const excimer = chamber?.excimer;
  const pixel =
    driver.current_pixel_index != null
      ? `${driver.current_pixel_index} / ${driver.num_pixel_positions ?? "?"}`
      : "—";

  const temperature = (
    <Field label="Temperature" key="t">
      {txt(`${fmt(heater?.temperature, 1, " °C")} → ${fmt(heater?.temperature_setpoint, 1, " °C")}`)}
    </Field>
  );
  const heatingLaser = (
    <Field label="Heating laser" key="hl">
      <BoolBadge value={heater?.power_on} />
    </Field>
  );
  const target = (
    <Field label="Target" key="tg">
      {txt(motion?.target || "between slots")}
    </Field>
  );
  const pressure = (
    <Field label="Pressure" key="p">
      {txt(
        pressures?.ig1_on
          ? `${fmtTorr(pressures.ig1)} (IG1)`
          : `${fmtTorr(pressures?.cdg10)} (CDG10)`
      )}
    </Field>
  );

  const readings: Record<Reading, ReactNode> = {
    temperature,
    heatingLaser,
    pid: (
      <Field label="PID" key="pid">
        <BoolBadge value={heater?.pid_on} />
      </Field>
    ),
    excimer: (
      <Field label="Excimer" key="ex">
        {txt([excimer?.status || excimer?.opmode, excimer?.mode].filter(Boolean).join(" · ") || "—")}
      </Field>
    ),
    excimerEnergy: (
      <Field label="Energy set / read" key="en">
        {txt(`${fmt(excimer?.energy_set, 1)} / ${fmt(excimer?.energy, 1, " mJ")}`)}
      </Field>
    ),
    excimerHv: (
      <Field label="HV" key="hv">
        {txt(fmt(excimer?.hv, 2, " kV"))}
      </Field>
    ),
    excimerRange: (
      <Field label="Allowed" key="rg">
        {txt(
          `${fmt(excimer?.energy_min, 0)}–${fmt(excimer?.energy_max, 0, " mJ")} · ${fmt(excimer?.hv_min, 1)}–${fmt(
            excimer?.hv_max,
            1,
            " kV"
          )}`
        )}
      </Field>
    ),
    confirmedPower: (
      <Field label="Confirmed power" key="lp">
        {txt(`${fmt(driver.laser_power_set, 1)} → ${fmt(driver.laser_power_real, 1)}`)}
      </Field>
    ),
    target,
    spin: (
      <Field label="Spin" key="spin">
        <BoolBadge value={motion?.target_spinning} onLabel="spin" offLabel="spin off" />
      </Field>
    ),
    twist: (
      <Field label="Twist" key="twist">
        <BoolBadge value={motion?.target_twisting} onLabel="twist" offLabel="twist off" />
      </Field>
    ),
    autoSpin: (
      <Field label="Auto spin" key="aspin">
        <BoolBadge value={motion?.auto_spin} onLabel="with laser" offLabel="off" />
      </Field>
    ),
    autoTwist: (
      <Field label="Auto twist" key="atwist">
        <BoolBadge value={motion?.auto_twist} onLabel="with laser" offLabel="off" />
      </Field>
    ),
    shutter: (
      <Field label="Shutter" key="sh">
        <BoolBadge value={chamber?.sample_shutter_away} onLabel="open" offLabel="closed" />
      </Field>
    ),
    pressure,
    cdg: (
      <Field label="CDG10 / CDG11" key="cdg">
        {txt(`${fmtTorr(pressures?.cdg10)} / ${fmtTorr(pressures?.cdg11)}`)}
      </Field>
    ),
    mfc: (
      <Field label="MFC1 set / flow" key="mfc">
        {txt(`${fmt(gas?.mfc1_setpoint, 2)} / ${fmt(gas?.mfc1_flow, 2, " sccm")}`)}
      </Field>
    ),
    pressureControl: (
      <Field label="Pressure control" key="pc">
        <BoolBadge value={gas?.pressure_control} />
      </Field>
    ),
    pressureSetpoint: (
      <Field label="Setpoint" key="sp">
        {txt(`${fmtTorr(gas?.pressure_setpoint)}${gas?.pressure_mode ? ` · ${gas.pressure_mode}` : ""}`)}
      </Field>
    ),
    mask: (
      <Field label="Mask" key="m">
        {txt(fmt(motion?.mask_position, 2, " mm"))}
      </Field>
    ),
    maskCalibration: (
      <Field label="Mask center (calibration)" key="mc">
        {txt(fmt(driver.center_mask_pos, 3, " mm"))}
      </Field>
    ),
    rheedGun: (
      <Field label="RHEED gun" key="r">
        {txt(fmt(motion?.rheed_gun_x, 2, " mm"))}
      </Field>
    ),
    sampleAngle: (
      <Field label="Sample angle" key="a">
        {txt(fmt(motion?.sample_angle, 1, "°"))}
      </Field>
    ),
    motorFree: (
      <Field label="Motor free" key="mf">
        <BoolBadge value={motion?.motor_free} onLabel="released" offLabel="held" />
      </Field>
    ),
    pixel: (
      <Field label="Pixel" key="px">
        {txt(pixel)}
      </Field>
    ),
    substrate: (
      <Field label="Substrate" key="s">
        {txt(driver.substrate_id ?? "none loaded")}
      </Field>
    ),
    project: (
      <Field label="Project" key="pr">
        {txt(driver.project_name || "—")}
      </Field>
    ),
    growthLog: (
      <Field label="Growth log" key="gl">
        {pldNode.log_file ? <TruncatedText text={pldNode.log_file} /> : txt("not logging")}
      </Field>
    ),
    recording: (
      <Field label="Recording" key="rec">
        <BoolBadge value={driver.is_recording} />
      </Field>
    ),
  };
  const keys = op.readings ?? CATEGORY_READINGS[op.category];
  if (keys.length === 0) return null;

  return (
    <Box borderWidth="1px" borderColor="panel.border" borderRadius="md" px={2} py={1}>
      {!chamber && (
        <Text fontSize="0.65rem" color="text.muted">
          No chamber.pld state yet -- readings below are blank.
        </Text>
      )}
      <SimpleGrid minChildWidth="200px" spacingX={4} spacingY="1px">
        {keys.map((k) => readings[k])}
      </SimpleGrid>
    </Box>
  );
};

export default OpLiveContext;
