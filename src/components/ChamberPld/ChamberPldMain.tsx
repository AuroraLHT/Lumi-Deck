import {
  Alert,
  AlertIcon,
  Badge,
  Center,
  Grid,
  HStack,
  SimpleGrid,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";

import useAppStore from "../../stores/app";
import useChamberPldNodeStore from "../../stores/nodes/chamberPld";
import useChamberPldStore from "../../stores/chamberPld";
import { AxisBadge, BoolBadge, Field, Section, fmt, fmtTorr, pumpLabel } from "./primitives";

const AXIS_LABELS: Record<string, string> = {
  TG: "Target carousel",
  Mask1: "Mask",
  "RHEED gun X": "RHEED gun X",
  Substrate: "Substrate",
};

const timeLabel = (epochSeconds: number) =>
  new Date(epochSeconds * 1000).toLocaleTimeString();

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
  const events = useChamberPldStore((s) => s.events);

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

      <Section title="Overview">
        <SimpleGrid columns={2} spacingX={4} spacingY="1px">
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
            <Text fontSize="xs" noOfLines={1}>
              {node.address ?? "—"}
            </Text>
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
              <Text fontSize="xs" noOfLines={1}>
                {node.log_file}
              </Text>
            ) : (
              <Text fontSize="xs" color="text.muted">
                not logging
              </Text>
            )}
          </Field>
          <Field label="PLC session">
            <BoolBadge value={chamber?.session?.plc_session} onLabel="open" offLabel="closed" />
          </Field>
          <Field label="Watchdog">
            <BoolBadge value={chamber?.session?.watchdog} />
          </Field>
        </SimpleGrid>
      </Section>

      {!chamber ? (
        <Center minH="120px">
          <Text fontSize="sm" color="text.muted">
            Waiting for chamber state…
          </Text>
        </Center>
      ) : (
        <Grid templateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap={2}>
          <Section title="Pressures">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="IG1 (main)">
                <Text fontSize="xs">
                  {chamber.pressures?.ig1_on
                    ? fmtTorr(chamber.pressures?.ig1)
                    : "filament off"}
                </Text>
              </Field>
              <Field label="IG3 (load lock)">
                <Text fontSize="xs">
                  {chamber.pressures?.ig3_on
                    ? fmtTorr(chamber.pressures?.ig3)
                    : "filament off"}
                </Text>
              </Field>
              <Field label="CDG10">
                <Text fontSize="xs">{fmtTorr(chamber.pressures?.cdg10)}</Text>
              </Field>
              <Field label="CDG11">
                <Text fontSize="xs">{fmtTorr(chamber.pressures?.cdg11)}</Text>
              </Field>
              <Field label="TCG31">
                <Text fontSize="xs">{fmtTorr(chamber.pressures?.tcg31)}</Text>
              </Field>
              {(chamber.pressures?.tcg ?? []).map((v, i) => (
                <Field label={`TCG${i + 1}`} key={i}>
                  <Text fontSize="xs">{fmtTorr(v)}</Text>
                </Field>
              ))}
            </SimpleGrid>
            {chamber.limits && (
              <Text fontSize="xs" color="text.muted" mt={2}>
                IG1 off above {fmtTorr(chamber.limits.ig1_max_torr)} (CDG10) · IG3 off above{" "}
                {fmtTorr(chamber.limits.ig3_max_torr)} (TCG31) · MV3 refused above{" "}
                {fmtTorr(chamber.limits.mv3_max_torr)} (TCG31)
              </Text>
            )}
          </Section>

          <Section title="Heater">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="Temperature">
                <Text fontSize="xs">
                  {fmt(chamber.heater?.temperature, 1, " °C")}
                </Text>
              </Field>
              <Field label="Setpoint → goal">
                <Text fontSize="xs">
                  {fmt(chamber.heater?.temperature_setpoint, 1, " °C")} →{" "}
                  {fmt(chamber.heater?.temperature_goal, 1, " °C")}
                </Text>
              </Field>
              <Field label="Ramp">
                <Text fontSize="xs">
                  {chamber.heater?.ramp_c_per_min
                    ? `${chamber.heater.ramp_c_per_min} °C/min`
                    : "jump"}
                </Text>
              </Field>
              <Field label="PID">
                <BoolBadge value={chamber.heater?.pid_on} />
              </Field>
              <Field label="Current set → monitor">
                <Text fontSize="xs">
                  {fmt(chamber.heater?.current_set, 2, " A")} →{" "}
                  {fmt(chamber.heater?.current_monitor, 2, " A")}
                </Text>
              </Field>
              <Field label="Current limits">
                <Text fontSize="xs">
                  {fmt(chamber.heater?.current_min, 2)}–
                  {fmt(chamber.heater?.current_max, 2, " A")}
                </Text>
              </Field>
              <Field label="Trip limits">
                <Text fontSize="xs">
                  {fmt(chamber.limits?.heater_max_celsius, 0, " °C")} /{" "}
                  {fmt(chamber.limits?.heater_max_amps, 2, " A")}
                </Text>
              </Field>
              <Field label="Key / start / threshold">
                <HStack spacing={1} justify="flex-end">
                  <BoolBadge value={chamber.heater?.key_on} />
                  <BoolBadge value={chamber.heater?.start_on} />
                  <BoolBadge value={chamber.heater?.threshold_on} />
                </HStack>
              </Field>
              <Field label="Auto-tune">
                <HStack spacing={1} justify="flex-end">
                  <BoolBadge value={chamber.heater?.auto_tune} />
                  {chamber.heater?.auto_tune && chamber.heater?.tune_cycles ? (
                    <Text fontSize="xs" color="text.muted">
                      {chamber.heater?.tune_cycles_done ?? 0}/{chamber.heater.tune_cycles}
                    </Text>
                  ) : null}
                </HStack>
              </Field>
            </SimpleGrid>
            {chamber.heater?.writes_failing && (
              <Text fontSize="xs" color="status.error" mt={1}>
                LD current writes are failing
              </Text>
            )}
          </Section>

          <Section title="Motion">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="Target">
                <Text fontSize="xs">
                  {chamber.motion?.target || "(between slots)"}
                  {chamber.motion?.target_angle != null &&
                    ` @ ${fmt(chamber.motion.target_angle, 1, "°")}`}
                </Text>
              </Field>
              <Field label="Sample angle">
                <Text fontSize="xs">
                  {fmt(chamber.motion?.sample_angle, 1, "°")}
                </Text>
              </Field>
              <Field label="Mask position">
                <Text fontSize="xs">
                  {fmt(chamber.motion?.mask_position, 2, " mm")}
                </Text>
              </Field>
              <Field label="RHEED gun X">
                <Text fontSize="xs">
                  {fmt(chamber.motion?.rheed_gun_x, 2, " mm")}
                </Text>
              </Field>
              <Field label="Spin / twist">
                <HStack spacing={1} justify="flex-end">
                  <BoolBadge
                    value={chamber.motion?.target_spinning}
                    onLabel="spin"
                    offLabel="spin off"
                  />
                  <BoolBadge
                    value={chamber.motion?.target_twisting}
                    onLabel="twist"
                    offLabel="twist off"
                  />
                </HStack>
              </Field>
              <Field label="Motor free">
                <BoolBadge value={chamber.motion?.motor_free} />
              </Field>
            </SimpleGrid>
            <VStack align="stretch" spacing="1px" mt={2}>
              {Object.entries(chamber.motion?.axes ?? {}).map(
                ([axis, status]) => (
                  <Field label={AXIS_LABELS[axis] ?? axis} key={axis}>
                    <AxisBadge status={status} />
                  </Field>
                )
              )}
            </VStack>
          </Section>

          <Section title="Valves">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              {Object.entries(chamber.valves ?? {}).map(([name, open]) => (
                <Field label={name} key={name}>
                  <BoolBadge value={open} onLabel="open" offLabel="closed" />
                </Field>
              ))}
            </SimpleGrid>
          </Section>

          <Section title="Gas & pressure control">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="MFC1 setpoint → flow">
                <Text fontSize="xs">
                  {fmt(chamber.gas?.mfc1_setpoint, 1, " sccm")} →{" "}
                  {fmt(chamber.gas?.mfc1_flow, 1, " sccm")}
                </Text>
              </Field>
              <Field label="Pumping">
                <Text fontSize="xs">{chamber.gas?.pumping ?? "—"}</Text>
              </Field>
              <Field label="Pressure control">
                <BoolBadge value={chamber.gas?.pressure_control} />
              </Field>
              <Field label="Setpoint">
                <Text fontSize="xs">
                  {fmtTorr(chamber.gas?.pressure_setpoint)}
                </Text>
              </Field>
              <Field label="Gauge / mode">
                <Text fontSize="xs">
                  {chamber.gas?.pressure_gauge || "—"} /{" "}
                  {chamber.gas?.pressure_mode ?? "—"}
                </Text>
              </Field>
            </SimpleGrid>
          </Section>

          <Section title="Laser trigger">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="Status">
                <HStack spacing={1} justify="flex-end">
                  <Text fontSize="xs">{chamber.laser?.status ?? "—"}</Text>
                  {chamber.laser?.stop_requested && (
                    <Badge colorScheme="orange" variant="subtle" fontSize="0.65rem">
                      stop requested
                    </Badge>
                  )}
                </HStack>
              </Field>
              <Field label="Rate">
                <Text fontSize="xs">
                  {chamber.laser?.status === "firing" ? fmt(chamber.laser?.rate_hz, 1, " Hz") : "—"}
                </Text>
              </Field>
              <Field label="Fired / requested">
                <Text fontSize="xs">
                  {chamber.laser?.pulses_fired ?? 0} / {chamber.laser?.pulses_requested ?? 0}
                </Text>
              </Field>
              <Field label="Missed shots">
                <Text fontSize="xs">{chamber.laser?.missed_shots ?? 0}</Text>
              </Field>
            </SimpleGrid>
          </Section>

          <Section title="Excimer (COMPexPro)">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="Present / connected">
                <HStack spacing={1} justify="flex-end">
                  <BoolBadge value={chamber.excimer?.present} />
                  <BoolBadge value={chamber.excimer?.connected} />
                </HStack>
              </Field>
              <Field label="Opmode">
                <Text fontSize="xs">
                  {chamber.excimer?.opmode ?? "—"}
                  {chamber.excimer?.waiting && " (switching, ~8s)"}
                </Text>
              </Field>
              <Field label="Mode">
                <Text fontSize="xs">{chamber.excimer?.mode ?? "—"}</Text>
              </Field>
              <Field label="HV set">
                <Text fontSize="xs">{fmt(chamber.excimer?.hv, 1, " kV")}</Text>
              </Field>
              <Field label="Energy set → measured">
                <Text fontSize="xs">
                  {fmt(chamber.excimer?.energy_set, 0, " mJ")} →{" "}
                  {fmt(chamber.excimer?.energy, 0, " mJ")}
                </Text>
              </Field>
              <Field label="CM (settings port)">
                {chamber.excimer?.present == null ||
                chamber.excimer?.control == null ? (
                  <Text fontSize="xs" color="text.muted">
                    —
                  </Text>
                ) : (
                  <BoolBadge
                    value={chamber.excimer.control}
                    onLabel="this PC"
                    offLabel="other PC"
                  />
                )}
              </Field>
              {(chamber.excimer?.codes ?? []).length > 0 && (
                <Field label="Codes">
                  <VStack align="flex-end" spacing="1px">
                    {chamber.excimer!.codes!.map((c, i) => (
                      <Text fontSize="xs" key={i}>
                        {c.code} {c.kind ? `(${c.kind})` : ""} {c.meaning}
                      </Text>
                    ))}
                  </VStack>
                </Field>
              )}
            </SimpleGrid>
          </Section>

          <Section title="Pumps">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              {Object.entries(chamber.pumps ?? {}).map(([name, pump]) => (
                <Field label={pumpLabel(name)} key={name}>
                  <HStack spacing={1} justify="flex-end">
                    <Text fontSize="xs" color="text.muted">
                      {pump.state ?? "—"}
                    </Text>
                    <BoolBadge
                      value={pump.at_speed}
                      onLabel="at speed"
                      offLabel={pump.running ? "spinning up" : "stopped"}
                    />
                  </HStack>
                </Field>
              ))}
            </SimpleGrid>
          </Section>

          <Section title="Load lock">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="Hatch closed">
                <BoolBadge value={chamber.load_lock?.hatch_closed} />
              </Field>
              <Field label="GV1">
                <Text fontSize="xs">{chamber.load_lock?.gv1 ?? "—"}</Text>
              </Field>
              <Field label="Sequence">
                <Text fontSize="xs">
                  {chamber.load_lock?.sequence || "idle"}
                  {chamber.load_lock?.by_service === false &&
                    chamber.load_lock?.sequence &&
                    " (PLC's own)"}
                </Text>
              </Field>
              <Field label="Step">
                <Text fontSize="xs">{chamber.load_lock?.step || "—"}</Text>
              </Field>
              <Field label="Below SP1 / SP2">
                <HStack spacing={1} justify="flex-end">
                  <BoolBadge value={chamber.load_lock?.below_sp1} />
                  <BoolBadge value={chamber.load_lock?.below_sp2} />
                </HStack>
              </Field>
            </SimpleGrid>
          </Section>

          <Section title="Shutter & interlocks">
            <SimpleGrid columns={2} spacingX={4} spacingY="1px">
              <Field label="Sample shutter away">
                <BoolBadge
                  value={chamber.sample_shutter_away}
                  onLabel="away (open)"
                  offLabel="in front"
                />
              </Field>
            </SimpleGrid>
            {(chamber.interlocks ?? []).length > 0 ? (
              <VStack align="stretch" spacing="1px" mt={2}>
                {chamber.interlocks!.map((name) => (
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
        </Grid>
      )}

      <Section title="Recent events">
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
                <Text noOfLines={1}>{e.message}</Text>
              </HStack>
            ))}
          </VStack>
        )}
      </Section>
    </VStack>
  );
};

export default ChamberPldMain;
