import { memo } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Center,
  Grid,
  HStack,
  SimpleGrid,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";

import useAppStore from "../../stores/app";
import useChamberPldNodeStore, { ChamberPldNodeState } from "../../stores/nodes/chamberPld";
import useChamberPldStore from "../../stores/chamberPld";
import {
  AxisBadge,
  BoolBadge,
  Field,
  PumpStateBadge,
  Section,
  TruncatedText,
  fmt,
  fmtTorr,
  sortedEntries,
} from "./primitives";
import {
  PldBypass,
  PldExcimer,
  PldGas,
  PldHeater,
  PldLaser,
  PldLimits,
  PldLoadLock,
  PldMotion,
  PldPressures,
  PldPump,
  PldSession,
} from "../../generated/lumi";
import { ActivityList } from "./ActivityList";
import RheedStatus from "./RheedStatus";

const AXIS_LABELS: Record<string, string> = {
  TG: "Target carousel",
  Mask1: "Mask",
  "RHEED gun X": "RHEED gun X",
  Substrate: "Substrate",
};

const timeLabel = (epochSeconds: number) =>
  new Date(epochSeconds * 1000).toLocaleTimeString();

/**
 * pld-service's own event log, newest first. Its own component, memoized and
 * reading the store itself, so the chamber's state pushes (twice a second)
 * don't re-render 200 rows that only change when the 5 s events poll does.
 */
const RecentEvents = memo(() => {
  const events = useChamberPldStore((s) => s.events);
  return (
    <>
      {events.length === 0 ? (
        <Text fontSize="xs" color="text.muted">
          No events yet
        </Text>
      ) : (
        <VStack align="stretch" spacing="2px" maxH="160px" overflowY="auto">
          {events.map((e, i) => (
            <HStack key={i} spacing={2} fontSize="xs">
              <Text color="text.muted" flexShrink={0}>
                {e.time != null ? timeLabel(e.time) : "—"}
              </Text>
              <Badge variant="subtle" fontSize="0.6rem" flexShrink={0}>
                {e.kind ?? "event"}
              </Badge>
              <Box flex={1} minW={0}>
                <TruncatedText text={e.message} />
              </Box>
            </HStack>
          ))}
        </VStack>
      )}
    </>
  );
});
RecentEvents.displayName = "RecentEvents";

/*
 * Each section below is memoized on its own slice of the state. The store keeps
 * a slice the same object while it is unchanged (`replaceEqualDeep`), so a push
 * re-renders only the sections whose readings moved.
 */
const Overview = memo(({ node, session }: { node: ChamberPldNodeState; session?: PldSession }) => (
  <Section title="Overview">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Backend">
        <Badge
          variant="subtle"
          colorScheme={node.backend === "HARDWARE" ? "cyan" : "purple"}
          fontSize="0.65rem"
        >
          {node.backend ?? "unknown"}
        </Badge>
      </Field>
      <Field label="Connected">
        <BoolBadge value={node.connected} onLabel="yes" offLabel="no" />
      </Field>
      <Field label="Read-only">
        <BoolBadge value={node.read_only} onLabel="yes" offLabel="no" />
      </Field>
      <Field label="Driver">
        <Text fontSize="xs">{node.driver ?? "—"}</Text>
      </Field>
      <Field label="Controller">
        <Tooltip label="pld-service's controller field can lag an actual control change by about a poll.">
          <Text fontSize="xs">
            {node.controller ? node.controller : "nobody"}
            {node.holds_control && " (this console)"}
          </Text>
        </Tooltip>
      </Field>
      <Field label="Address">
        <TruncatedText text={node.address} />
      </Field>
      <Field label="Laser control (CM)">
        {node.laser_control == null ? (
          <Text fontSize="xs" color="text.muted">
            no link
          </Text>
        ) : (
          <BoolBadge
            value={node.laser_control}
            onLabel="this PC"
            offLabel="other PC"
          />
        )}
      </Field>
      <Field label="Logging">
        {node.log_file ? (
          <TruncatedText text={node.log_file} />
        ) : (
          <Text fontSize="xs" color="text.muted">
            not logging
          </Text>
        )}
      </Field>
      <Field label="PLC session">
        <BoolBadge value={session?.plc_session} onLabel="open" offLabel="closed" />
      </Field>
      <Field label="Watchdog">
        <HStack spacing={1} justify="flex-end">
          <BoolBadge value={session?.watchdog} />
          {session?.valves_locked && (
            <Badge
              colorScheme="red"
              variant="subtle"
              fontSize="0.65rem"
              title="The PLC watchdog tripped (DM30146 bit 8 off): opening MV10, MV11, MV20 and MV21 is refused until PLD Controller's start-up clears it."
            >
              valves locked
            </Badge>
          )}
        </HStack>
      </Field>
    </SimpleGrid>
  </Section>
));
Overview.displayName = "Overview";

const PressuresSection = memo(({ pressures, limits }: { pressures?: PldPressures; limits?: PldLimits }) => (
  <Section title="Pressures">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="IG1 (main)">
        <Text fontSize="xs">
          {pressures?.ig1_on
            ? fmtTorr(pressures?.ig1)
            : "filament off"}
        </Text>
      </Field>
      <Field label="IG3 (load lock)">
        <Text fontSize="xs">
          {pressures?.ig3_on
            ? fmtTorr(pressures?.ig3)
            : "filament off"}
        </Text>
      </Field>
      <Field label="CDG10">
        <Text fontSize="xs">{fmtTorr(pressures?.cdg10)}</Text>
      </Field>
      <Field label="CDG11">
        <Text fontSize="xs">{fmtTorr(pressures?.cdg11)}</Text>
      </Field>
      <Field label="TCG31">
        <Text fontSize="xs">{fmtTorr(pressures?.tcg31)}</Text>
      </Field>
      {(pressures?.tcg ?? []).map((v, i) => (
        <Field label={`TCG${i + 1}`} key={i}>
          <Text fontSize="xs">{fmtTorr(v)}</Text>
        </Field>
      ))}
    </SimpleGrid>
    {limits && (
      <Text fontSize="xs" color="text.muted" mt={2}>
        IG1 off above {fmtTorr(limits.ig1_max_torr)} (CDG10)
        {limits.ig1_off_torr != null && ` or ${fmtTorr(limits.ig1_off_torr)} (its own reading)`} · IG3 off above{" "}
        {fmtTorr(limits.ig3_max_torr)} (TCG31) · MV3 refused above{" "}
        {fmtTorr(limits.mv3_max_torr)} (TCG31)
      </Text>
    )}
  </Section>
));
PressuresSection.displayName = "PressuresSection";

const HeaterSection = memo(({ heater, limits }: { heater?: PldHeater; limits?: PldLimits }) => (
  <Section title="Heater">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Temperature">
        <Text fontSize="xs">
          {fmt(heater?.temperature, 1, " °C")}
        </Text>
      </Field>
      <Field label="Setpoint → goal">
        <Text fontSize="xs">
          {fmt(heater?.temperature_setpoint, 1, " °C")} →{" "}
          {fmt(heater?.temperature_goal, 1, " °C")}
        </Text>
      </Field>
      <Field label="Ramp">
        <Text fontSize="xs">
          {heater?.ramp_c_per_min
            ? `${heater.ramp_c_per_min} °C/min`
            : "jump"}
        </Text>
      </Field>
      <Field label="PID">
        <BoolBadge value={heater?.pid_on} />
      </Field>
      <Field label="Current set → monitor">
        <Text fontSize="xs">
          {fmt(heater?.current_set, 2, " A")} →{" "}
          {fmt(heater?.current_monitor, 2, " A")}
        </Text>
      </Field>
      <Field label="Current limits">
        <Text fontSize="xs">
          {fmt(heater?.current_min, 2)}–
          {fmt(heater?.current_max, 2, " A")}
        </Text>
      </Field>
      <Field label="Trip limits">
        <Text fontSize="xs">
          {fmt(limits?.heater_max_celsius, 0, " °C")} /{" "}
          {fmt(limits?.heater_max_amps, 2, " A")}
        </Text>
      </Field>
      <Field label="Key / start / threshold">
        <HStack spacing={1} justify="flex-end">
          <BoolBadge value={heater?.key_on} />
          <BoolBadge value={heater?.start_on} />
          <BoolBadge value={heater?.threshold_on} />
        </HStack>
      </Field>
      <Field label="Auto-tune">
        <HStack spacing={1} justify="flex-end">
          <BoolBadge value={heater?.auto_tune} />
          {heater?.auto_tune && heater?.tune_cycles ? (
            <Text fontSize="xs" color="text.muted">
              {heater?.tune_cycles_done ?? 0}/{heater.tune_cycles}
            </Text>
          ) : null}
        </HStack>
      </Field>
    </SimpleGrid>
    {heater?.writes_failing && (
      <Text fontSize="xs" color="status.error" mt={1}>
        LD current writes are failing
      </Text>
    )}
  </Section>
));
HeaterSection.displayName = "HeaterSection";

const MotionSection = memo(({ motion }: { motion?: PldMotion }) => (
  <Section title="Motion">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Target">
        <Text fontSize="xs">
          {motion?.target || "(between slots)"}
          {motion?.target_angle != null &&
            ` @ ${fmt(motion.target_angle, 1, "°")}`}
        </Text>
      </Field>
      <Field label="Sample angle">
        <Text fontSize="xs">
          {fmt(motion?.sample_angle, 1, "°")}
        </Text>
      </Field>
      <Field label="Mask position">
        <Text fontSize="xs">
          {fmt(motion?.mask_position, 2, " mm")}
        </Text>
      </Field>
      <Field label="RHEED gun X">
        <Text fontSize="xs">
          {fmt(motion?.rheed_gun_x, 2, " mm")}
        </Text>
      </Field>
      <Field label="Spin">
        <BoolBadge
          value={motion?.target_spinning}
          onLabel="spin"
          offLabel="spin off"
        />
      </Field>
      <Field label="Twist">
        <BoolBadge
          value={motion?.target_twisting}
          onLabel="twist"
          offLabel="twist off"
        />
      </Field>
      <Field label="Motor free">
        <BoolBadge value={motion?.motor_free} />
      </Field>
      {motion?.sample_too_low && (
        <Field label="Sample height">
          <Tooltip label="The sample is below its height threshold: Mask1 moves and homing are refused until a person raises it">
            <Badge colorScheme="red" variant="subtle" fontSize="0.65rem">
              too low
            </Badge>
          </Tooltip>
        </Field>
      )}
      <Field label="Motor stop">
        {motion?.motors_stopped ? (
          <Tooltip label="Moves, homing, spin, twist and fires are refused until the motors are reset">
            <Badge colorScheme="red" variant="subtle" fontSize="0.65rem">
              latched
            </Badge>
          </Tooltip>
        ) : (
          <Text fontSize="xs" color="text.muted">
            —
          </Text>
        )}
      </Field>
    </SimpleGrid>
    {(motion?.homing_needed ?? []).length > 0 && (
      <Text fontSize="xs" color="status.warn" mt={1}>
        Home before relying on the position: {motion!.homing_needed!.join(", ")} (stopped mid-move)
      </Text>
    )}
    <VStack align="stretch" spacing="1px" mt={2}>
      {sortedEntries(motion?.axes).map(
        ([axis, status]) => (
          <Field label={AXIS_LABELS[axis] ?? axis} key={axis}>
            <AxisBadge status={status} />
          </Field>
        )
      )}
    </VStack>
  </Section>
));
MotionSection.displayName = "MotionSection";

const BYPASS_STATE_COLOR: Record<string, string> = {
  IDLE: "gray",
  MOVE: "blue",
  SEEK_OPEN: "orange",
  SEEK_CLOSE: "orange",
  SETTLE: "purple",
};

/**
 * The bypass-valve stepper; only rendered when pld-service has a bypass board.
 * `open_fraction` is the service's own position / open_position -- null until
 * the valve is homed and the open switch position is known, so the panel never
 * guesses the travel or which end closes.
 */
const BypassSection = memo(({ bypass }: { bypass?: PldBypass }) => {
  if (!bypass?.present) return null;
  return (
    <Section title="Bypass valve">
      <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
        <Field label="State">
          <Badge variant="subtle" colorScheme={BYPASS_STATE_COLOR[bypass.state ?? ""] ?? "gray"} fontSize="0.65rem">
            {(bypass.state || "—").toLowerCase().replace("_", " ")}
          </Badge>
        </Field>
        <Field label="Open">
          <Text fontSize="xs">{bypass.open_fraction == null ? "—" : `${(bypass.open_fraction * 100).toFixed(0)} %`}</Text>
        </Field>
        <Field label="Position">
          <Text fontSize="xs">
            {bypass.position == null ? "—" : `${Math.round(bypass.position)} steps`}
            {bypass.open_position != null && ` / open at ${bypass.open_position}`}
          </Text>
        </Field>
        <Field label="Homed">
          {bypass.homed ? (
            <BoolBadge value onLabel="homed" />
          ) : (
            <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
              not homed
            </Badge>
          )}
        </Field>
        {bypass.motion_enabled === false && (
          <Field label="Motor movement">
            <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
              disabled
            </Badge>
          </Field>
        )}
        <Field label="Close / open switch">
          <HStack spacing={1} justify="flex-end">
            <BoolBadge value={bypass.close_switch} onLabel="closed" offLabel="—" />
            <BoolBadge value={bypass.open_switch} onLabel="open" offLabel="—" />
          </HStack>
        </Field>
        <Field label="Speed">
          <Text fontSize="xs">
            {fmt(bypass.rpm, 1, " rpm")}
            {bypass.max_rpm != null && ` (max ${bypass.max_rpm})`}
          </Text>
        </Field>
        <Field label="Coils">
          <BoolBadge value={bypass.energized} onLabel="energized" offLabel="off" />
        </Field>
        <Field label="Board">
          <HStack spacing={1} justify="flex-end">
            <Text fontSize="xs">
              {bypass.port || "—"}
              {bypass.firmware && ` · fw ${bypass.firmware}`}
            </Text>
            <BoolBadge value={bypass.connected} onLabel="connected" offLabel="no link" />
          </HStack>
        </Field>
        <Field label={`Last move end (${bypass.moves_ended ?? 0})`}>
          <TruncatedText text={bypass.last_end} />
        </Field>
      </SimpleGrid>
      {bypass.error && (
        <Text fontSize="xs" color="status.error" mt={1}>
          {bypass.error}
        </Text>
      )}
    </Section>
  );
});
BypassSection.displayName = "BypassSection";

const ValvesSection = memo(({ valves }: { valves?: Record<string, boolean> }) => (
  <Section title="Valves">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      {sortedEntries(valves).map(([name, open]) => (
        <Field label={name} key={name}>
          <BoolBadge value={open} onLabel="open" offLabel="closed" />
        </Field>
      ))}
    </SimpleGrid>
  </Section>
));
ValvesSection.displayName = "ValvesSection";

const GasSection = memo(({ gas }: { gas?: PldGas }) => (
  <Section title="Gas & pressure control">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="MFC1 setpoint → flow">
        <Text fontSize="xs">
          {fmt(gas?.mfc1_setpoint, 1, " sccm")} →{" "}
          {fmt(gas?.mfc1_flow, 1, " sccm")}
        </Text>
      </Field>
      <Field label="Pumping">
        <Text fontSize="xs">{gas?.pumping ?? "—"}</Text>
      </Field>
      <Field label="Pressure control">
        <BoolBadge value={gas?.pressure_control} />
      </Field>
      <Field label="Setpoint">
        <Text fontSize="xs">
          {fmtTorr(gas?.pressure_setpoint)}
        </Text>
      </Field>
      <Field label="Gauge / mode">
        <Text fontSize="xs">
          {gas?.pressure_gauge || "—"} /{" "}
          {gas?.pressure_mode ?? "—"}
        </Text>
      </Field>
    </SimpleGrid>
  </Section>
));
GasSection.displayName = "GasSection";

const LaserSection = memo(({ laser }: { laser?: PldLaser }) => (
  <Section title="Laser trigger">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Status">
        <HStack spacing={1} justify="flex-end">
          <Text fontSize="xs">{laser?.status ?? "—"}</Text>
          {laser?.stop_requested && (
            <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
              stop requested
            </Badge>
          )}
        </HStack>
      </Field>
      <Field label="Rate">
        <Text fontSize="xs">
          {laser?.status === "firing" ? fmt(laser?.rate_hz, 1, " Hz") : "—"}
        </Text>
      </Field>
      <Field label="Fired / requested">
        <Text fontSize="xs">
          {laser?.pulses_fired ?? 0} / {laser?.pulses_requested ?? 0}
        </Text>
      </Field>
      <Field label="Missed shots">
        <Text fontSize="xs">{laser?.missed_shots ?? 0}</Text>
      </Field>
    </SimpleGrid>
  </Section>
));
LaserSection.displayName = "LaserSection";

const ExcimerSection = memo(({ excimer }: { excimer?: PldExcimer }) => (
  <Section title="Excimer (COMPexPro)">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Present / connected">
        <HStack spacing={1} justify="flex-end">
          <BoolBadge value={excimer?.present} />
          <BoolBadge value={excimer?.connected} />
        </HStack>
      </Field>
      <Field label="Opmode">
        <Text fontSize="xs">
          {excimer?.opmode ?? "—"}
          {excimer?.waiting && " (switching, ~8s)"}
        </Text>
      </Field>
      <Field label="Mode">
        <Text fontSize="xs">{excimer?.mode ?? "—"}</Text>
      </Field>
      <Field label="HV set">
        <Text fontSize="xs">{fmt(excimer?.hv, 1, " kV")}</Text>
      </Field>
      <Field label="Energy set → measured">
        <Text fontSize="xs">
          {fmt(excimer?.energy_set, 0, " mJ")} →{" "}
          {fmt(excimer?.energy, 0, " mJ")}
        </Text>
      </Field>
      <Field label="CM (settings port)">
        {excimer?.present == null ||
        excimer?.control == null ? (
          <Text fontSize="xs" color="text.muted">
            —
          </Text>
        ) : (
          <BoolBadge
            value={excimer.control}
            onLabel="this PC"
            offLabel="other PC"
          />
        )}
      </Field>
      {(excimer?.codes ?? []).length > 0 && (
        <Field label="Codes">
          <VStack align="flex-end" spacing="1px">
            {excimer!.codes!.map((c, i) => (
              <Text fontSize="xs" key={i}>
                {c.code} {c.kind ? `(${c.kind})` : ""} {c.meaning}
              </Text>
            ))}
          </VStack>
        </Field>
      )}
    </SimpleGrid>
  </Section>
));
ExcimerSection.displayName = "ExcimerSection";

const PumpsSection = memo(({ pumps }: { pumps?: Record<string, PldPump> }) => (
  <Section title="Pumps">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      {sortedEntries(pumps).map(([name, pump]) => (
        <Field label={name} key={name}>
          <PumpStateBadge state={pump.state} />
        </Field>
      ))}
    </SimpleGrid>
  </Section>
));
PumpsSection.displayName = "PumpsSection";

const LoadLockSection = memo(({ load_lock }: { load_lock?: PldLoadLock }) => (
  <Section title="Load lock">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Hatch closed">
        <BoolBadge value={load_lock?.hatch_closed} onLabel="yes" offLabel="no" />
      </Field>
      <Field label="GV1">
        <Text fontSize="xs">{load_lock?.gv1 ?? "—"}</Text>
      </Field>
      <Field label="Sequence">
        <Text fontSize="xs">
          {load_lock?.sequence || "idle"}
          {load_lock?.by_service === false &&
            load_lock?.sequence &&
            " (PLC's own)"}
        </Text>
      </Field>
      <Field label="Step">
        <Text fontSize="xs">{load_lock?.step || "—"}</Text>
      </Field>
      <Field label="Below SP1 / SP2">
        <HStack spacing={1} justify="flex-end">
          <BoolBadge value={load_lock?.below_sp1} onLabel="yes" offLabel="no" />
          <BoolBadge value={load_lock?.below_sp2} onLabel="yes" offLabel="no" />
        </HStack>
      </Field>
    </SimpleGrid>
  </Section>
));
LoadLockSection.displayName = "LoadLockSection";

const ShutterSection = memo(({ sample_shutter_away, interlocks }: { sample_shutter_away?: boolean; interlocks?: string[] }) => (
  <Section title="Shutter & interlocks">
    <SimpleGrid minChildWidth="220px" spacingX={4} spacingY="1px">
      <Field label="Sample shutter away">
        <BoolBadge
          value={sample_shutter_away}
          onLabel="away (open)"
          offLabel="in front"
        />
      </Field>
    </SimpleGrid>
    {(interlocks ?? []).length > 0 ? (
      <VStack align="stretch" spacing="1px" mt={2}>
        {interlocks!.map((name) => (
          <HStack key={name} spacing={1}>
            <Badge colorScheme="red" variant="subtle" fontSize="0.65rem">
              active
            </Badge>
            <Text fontSize="xs">{name}</Text>
          </HStack>
        ))}
      </VStack>
    ) : (
      <Text fontSize="xs" color="text.muted" mt={1}>
        No active interlocks
      </Text>
    )}
  </Section>
));
ShutterSection.displayName = "ShutterSection";

const RheedSection = memo(RheedStatus);

/**
 * The PLD chamber, as read from `chamber.pld`: pressures, heater, motion,
 * valves, gas, the excimer, pumps and the load lock.
 *
 * Read-only for now -- acting controls (acquire control, fire, home an axis,
 * ...) are a separate panel. `holds_control`/`controller` are shown as a
 * status, not something to act on from here.
 *
 * Node readout (driver, address, connected, who holds control) comes off the
 * registry heartbeat via `useNodeStates`; the rich state below (pressures,
 * heater, motion, ...) comes off the capability's own `state` stream via
 * `useChamberPldStream` -- see those two for why the split.
 */
const ChamberPldMain = () => {
  const host = useAppStore((s) => s.selectedHost);
  const node = useChamberPldNodeStore((s) => s.state);
  const chamber = useChamberPldStore((s) => s.chamber);

  if (!host) {
    return (
      <Center h="100%" minH="160px">
        <Text fontSize="sm" color="text.muted">
          Select a server to view the chamber.
        </Text>
      </Center>
    );
  }

  if (!node.is_available) {
    return (
      <Center h="100%" minH="160px">
        <Text fontSize="sm" color="text.muted">
          Chamber node is not running.
        </Text>
      </Center>
    );
  }

  const legacy = node.driver === "legacy-mi";

  return (
    <VStack align="stretch" spacing={2} p={2}>
      {legacy && (
        <Alert status="info" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          This chamber runs the legacy MI driver (--use-legacy-mi-mode).
          chamber.pld is mounted but refuses every op -- see the MI Mode panel
          for live control.
        </Alert>
      )}

      {!legacy && !node.connected && (
        <Alert status="warning" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          pld-service is not answering every port -- readings below may be
          stale.
        </Alert>
      )}

      {node.error && (
        <Alert status="error" borderRadius="md" fontSize="xs" py={2}>
          <AlertIcon />
          {node.error}
        </Alert>
      )}

      <Overview node={node} session={chamber?.session} />

      {!chamber ? (
        <Center minH="120px">
          <Text fontSize="sm" color="text.muted">
            Waiting for chamber state…
          </Text>
        </Center>
      ) : (
        <Grid templateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap={2}>
          <PressuresSection pressures={chamber.pressures} limits={chamber.limits} />
          <HeaterSection heater={chamber.heater} limits={chamber.limits} />
          <MotionSection motion={chamber.motion} />
          <ValvesSection valves={chamber.valves} />
          <BypassSection bypass={chamber.bypass} />
          <GasSection gas={chamber.gas} />
          <LaserSection laser={chamber.laser} />
          <ExcimerSection excimer={chamber.excimer} />
          <RheedSection rheed={chamber.rheed} />
          <PumpsSection pumps={chamber.pumps} />
          <LoadLockSection load_lock={chamber.load_lock} />
          <ShutterSection sample_shutter_away={chamber.sample_shutter_away} interlocks={chamber.interlocks} />
        </Grid>
      )}

      <Section title="Activity">
        <ActivityList />
      </Section>

      <Section title="Recent events">
        <RecentEvents />
      </Section>
    </VStack>
  );
};

export default ChamberPldMain;
