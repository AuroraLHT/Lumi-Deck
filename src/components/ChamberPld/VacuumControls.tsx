import { ReactNode, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  HStack,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuAlertTriangle } from "react-icons/lu";

import { PldChamberState, PldPumpRequest } from "../../generated/lumi";
import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { BoolBadge, Field, PumpStateBadge, Section, fmtTorr } from "./primitives";
import { AnyReply, Call, ConfirmOpButton, ReplyText, SwitchOp, operatorTitle, useReply } from "./controlPrimitives";
import GasFields from "./GasControls";

type PumpName = PldPumpRequest["pump"];

/** Which chamber each valve and pump serves, from the PLC's own labels (log_fields.py). */
const MAIN = { valves: ["MV10", "MV11", "FV1", "CV1", "CV301"], pumps: ["DP1", "TMP1"] };
const RHEED_PUMPING = { valves: ["MV20", "FV20", "MV21", "FV21"], pumps: ["DP2", "TMP20", "TMP21"] };
const LOAD_LOCK = { valves: ["MV3", "FV3", "RV3", "VT1", "VT2"], pumps: ["DP3", "TMP3"] };
const KNOWN = new Set([MAIN, RHEED_PUMPING, LOAD_LOCK].flatMap((g) => [...g.valves, ...g.pumps]));

/** What a valve is for, where the PLC's label says. */
const VALVE_NOTES: Record<string, string> = {
  MV11: "bypass",
  CV301: "gas line, PLC-managed",
  MV20: "RHEED",
  FV20: "RHEED",
  MV21: "2nd RHEED",
  FV21: "2nd RHEED",
  VT1: "N2 vent",
  VT2: "air vent",
};

/** A pump or load-lock action waiting for the operator to confirm it. */
type Pending = { kind: "pump"; name: string; on: boolean } | { kind: "vent" } | { kind: "vac" };

const StateLine = ({ label, children }: { label: string; children: ReactNode }) => (
  <Flex justify="space-between" gap={4} fontSize="sm">
    <Text color="text.muted">{label}</Text>
    <Text>{children}</Text>
  </Flex>
);

const StateBox = ({ children }: { children: ReactNode }) => (
  <VStack align="stretch" spacing={0.5} borderWidth="1px" borderColor="panel.border" borderRadius="md" p={2}>
    {children}
  </VStack>
);

const yesNo = (v: boolean | null | undefined) => (v == null ? "—" : v ? "yes" : "no");

/** The load lock's state, to check before venting or pumping it. */
const LoadLockState = ({ chamber }: { chamber: PldChamberState | null }) => {
  const ll = chamber?.load_lock;
  return (
    <StateBox>
      <StateLine label="Hatch closed">{yesNo(ll?.hatch_closed)}</StateLine>
      <StateLine label="GV1">{ll?.gv1 ?? "—"}</StateLine>
      <StateLine label="Below SP1 / SP2">
        {yesNo(ll?.below_sp1)} / {yesNo(ll?.below_sp2)}
      </StateLine>
      <StateLine label="DP3 / TMP3">
        {chamber?.pumps?.DP3?.state ?? "—"} / {chamber?.pumps?.TMP3?.state ?? "—"}
      </StateLine>
      <StateLine label="Sequence">{ll?.sequence || "idle"}</StateLine>
    </StateBox>
  );
};

/** Title, explanation and button text for a pending action, from the chamber as it is now. */
const describe = (p: Pending, chamber: PldChamberState | null) => {
  if (p.kind === "vent") {
    return {
      title: "Vent the load lock?",
      action: "Vent the load lock",
      body: (
        <>
          <Text fontSize="sm">
            This runs the PLC's Auto Vent sequence and brings the load lock up to atmosphere. Check GV1 is closed so
            the main chamber stays under vacuum.
          </Text>
          <LoadLockState chamber={chamber} />
        </>
      ),
    };
  }
  if (p.kind === "vac") {
    return {
      title: "Pump down the load lock?",
      action: "Pump down the load lock",
      body: (
        <>
          <Text fontSize="sm">
            This runs the PLC's Auto Vac sequence and pumps the load lock down. Check the hatch is closed.
          </Text>
          <LoadLockState chamber={chamber} />
        </>
      ),
    };
  }
  const where = LOAD_LOCK.pumps.includes(p.name)
    ? "the load lock"
    : RHEED_PUMPING.pumps.includes(p.name)
    ? "the RHEED differential pumping"
    : "the main chamber";
  return {
    title: `${p.on ? "Start" : "Stop"} ${p.name}?`,
    action: `${p.on ? "Start" : "Stop"} ${p.name}`,
    body: (
      <>
        <Text fontSize="sm">
          {p.on
            ? `This starts ${p.name} on ${where}. Check that the valves and backing pump around it are as you expect.`
            : `This stops ${p.name} on ${where}. Pressure can rise where it was pumping.${
                p.name.startsWith("TMP") ? " A turbo takes minutes to spin down (TMP1 about 4.5 min)." : ""
              }`}
        </Text>
        <StateBox>
          <StateLine label={`${p.name} now`}>{chamber?.pumps?.[p.name]?.state ?? "—"}</StateLine>
          <StateLine label="Load lock sequence">{chamber?.load_lock?.sequence || "idle"}</StateLine>
        </StateBox>
      </>
    ),
  };
};

/**
 * Pump switches and the load lock's sequences go through a warning first:
 * what the action does and the state to check, read live while it is open,
 * with Cancel focused so Enter does nothing harmful.
 */
const useConfirmedVacuum = () => {
  const call = useChamberPldCall();
  const [reply, setReply] = useReply();
  const [pending, setPending] = useState<Pending | null>(null);
  const chamber = useChamberPldStore((s) => s.chamber);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = () => {
    if (!pending) return;
    const p = pending;
    call
      .run((c): Promise<AnyReply> =>
        p.kind === "vent" ? c.auto_vent() : p.kind === "vac" ? c.auto_vac() : c.set_pump({ pump: p.name as PumpName, on: p.on })
      )
      .then((r) => {
        setReply(r ?? null);
        setPending(null);
      });
  };

  const shown = pending && describe(pending, chamber);
  const dialog = (
    <AlertDialog isOpen={shown != null} leastDestructiveRef={cancelRef} onClose={() => setPending(null)} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent bg="panel.bgElevated" borderColor="panel.border" borderWidth="1px">
          <AlertDialogHeader fontSize="md" display="flex" alignItems="center" gap={2}>
            <LuAlertTriangle color="var(--chakra-colors-orange-400)" />
            {shown?.title}
          </AlertDialogHeader>
          <AlertDialogBody>
            <VStack align="stretch" spacing={2}>
              {shown?.body}
            </VStack>
          </AlertDialogBody>
          <AlertDialogFooter gap={2}>
            <Button ref={cancelRef} size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" colorScheme="orange" isLoading={call.busy} onClick={confirm}>
              {shown?.action}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );

  return { call, reply, setReply, ask: setPending, dialog };
};

/** A sub-heading inside a chamber's section. */
const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <VStack align="stretch" spacing="2px" pt={1} borderTopWidth="1px" borderColor="panel.border">
    <Text fontSize="xs" fontWeight="600" color="text.secondary">
      {title}
    </Text>
    {children}
  </VStack>
);

/** A row's name, with what it is for in muted text after it. */
const RowName = ({ name, note }: { name: string; note?: string }) => (
  <Text fontSize="xs" color="text.muted" minW={0}>
    {name}
    {note && (
      <Text as="span" fontSize="0.65rem" ml={1.5} opacity={0.8}>
        {note}
      </Text>
    )}
  </Text>
);

/** Each pump's state beside its switch; the switch only asks, the warning sends. */
const PumpRows = ({ names, vacuum }: { names: string[]; vacuum: ReturnType<typeof useConfirmedVacuum> }) => {
  const pumps = useChamberPldStore((s) => s.chamber?.pumps);
  return (
    <>
      {names
        .filter((n) => pumps?.[n])
        .map((name) => (
          <Flex key={name} align="center" gap={2} minH="20px">
            <RowName name={name} />
            <Flex ml="auto" align="center" gap={2}>
              <PumpStateBadge state={pumps?.[name]?.state} />
              <Switch
                size="sm"
                aria-label={name}
                isChecked={Boolean(pumps?.[name]?.running)}
                isDisabled={!vacuum.call.canOperate || vacuum.call.busy}
                title={operatorTitle(vacuum.call)}
                onChange={(e) => vacuum.ask({ kind: "pump", name, on: e.target.checked })}
              />
            </Flex>
          </Flex>
        ))}
    </>
  );
};

/** Valve switches; open/close goes straight to the service, which vets it. */
const ValveRows = ({ names, call, onReply }: { names: string[]; call: Call; onReply: (r: AnyReply | null) => void }) => {
  const valves = useChamberPldStore((s) => s.chamber?.valves);
  return (
    <>
      {names
        .filter((n) => valves?.[n] != null)
        .map((name) => (
          <Flex key={name} align="center" gap={2} minH="20px">
            <RowName name={name} note={VALVE_NOTES[name]} />
            <Box ml="auto">
              <SwitchOp
                call={call}
                label=""
                ariaLabel={name}
                checked={Boolean(valves?.[name])}
                op={(c, open) => c.set_valve({ valve: name, open, wait: false })}
                onReply={onReply}
              />
            </Box>
          </Flex>
        ))}
    </>
  );
};

/** A gauge's ion-gauge filament switch, with its reading beside it. */
const GaugeRow = ({ gauge, call, onReply }: { gauge: "IG1" | "IG3"; call: Call; onReply: (r: AnyReply | null) => void }) => {
  const pressures = useChamberPldStore((s) => s.chamber?.pressures);
  const on = gauge === "IG1" ? pressures?.ig1_on : pressures?.ig3_on;
  const reading = gauge === "IG1" ? pressures?.ig1 : pressures?.ig3;
  return (
    <Flex align="center" gap={2} minH="20px">
      <RowName name={`${gauge} filament`} />
      <Text fontSize="xs" ml="auto" sx={{ fontVariantNumeric: "tabular-nums" }}>
        {on ? fmtTorr(reading) : "off"}
      </Text>
      <SwitchOp
        call={call}
        label=""
        ariaLabel={`${gauge} filament`}
        checked={Boolean(on)}
        op={(c, v) => c.set_ion_gauge({ gauge, on: v })}
        onReply={onReply}
      />
    </Flex>
  );
};

const Errors = ({ calls }: { calls: Call[] }) => (
  <>
    {calls.map(
      (c, i) =>
        c.error && (
          <Text key={i} fontSize="xs" color="status.error">
            {c.error}
          </Text>
        )
    )}
  </>
);

/**
 * The main chamber: its pumps, valves and ion gauge, the RHEED differential
 * pumping lines that hang off it, and its gas (MFC1 and the pressure loop).
 * Anything the PLC reports that is not in the known lists shows under Other,
 * so a new valve is never hidden.
 */
export const MainChamberControls = () => {
  const vacuum = useConfirmedVacuum();
  const valveCall = useChamberPldCall();
  const [valveReply, setValveReply] = useReply();
  const chamber = useChamberPldStore((s) => s.chamber);
  const otherValves = Object.keys(chamber?.valves ?? {}).filter((n) => !KNOWN.has(n)).sort();
  const otherPumps = Object.keys(chamber?.pumps ?? {}).filter((n) => !KNOWN.has(n)).sort();

  return (
    <Section title="Main chamber">
      {vacuum.dialog}
      <VStack align="stretch" spacing={2}>
        <Field label="CDG10 / IG1">
          <Text fontSize="xs" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtTorr(chamber?.pressures?.cdg10)} / {chamber?.pressures?.ig1_on ? fmtTorr(chamber?.pressures?.ig1) : "off"}
          </Text>
        </Field>
        <Group title="Pumps">
          <PumpRows names={MAIN.pumps} vacuum={vacuum} />
          <ReplyText reply={vacuum.reply} align="left" />
        </Group>
        <Group title="Valves & gauge">
          <ValveRows names={MAIN.valves} call={valveCall} onReply={setValveReply} />
          <GaugeRow gauge="IG1" call={valveCall} onReply={setValveReply} />
          <ReplyText reply={valveReply} align="left" />
        </Group>
        <Group title="RHEED differential pumping">
          <PumpRows names={RHEED_PUMPING.pumps} vacuum={vacuum} />
          <ValveRows names={RHEED_PUMPING.valves} call={valveCall} onReply={setValveReply} />
        </Group>
        {(otherValves.length > 0 || otherPumps.length > 0) && (
          <Group title="Other">
            <PumpRows names={otherPumps} vacuum={vacuum} />
            <ValveRows names={otherValves} call={valveCall} onReply={setValveReply} />
          </Group>
        )}
        <Group title="Gas (MFC1) & pressure control">
          <GasFields />
        </Group>
        <Errors calls={[vacuum.call, valveCall]} />
      </VStack>
    </Section>
  );
};

/**
 * The load lock: its state, the Auto Vent / Auto Vac sequences, and its own
 * pumps, valves and ion gauge. `cancel_load_lock` needs no control (same as
 * `stop_fire`) and stops whichever sequence is running, hence its confirm.
 */
export const LoadLockControls = () => {
  const vacuum = useConfirmedVacuum();
  const valveCall = useChamberPldCall();
  const [valveReply, setValveReply] = useReply();
  const chamber = useChamberPldStore((s) => s.chamber);
  const ll = chamber?.load_lock;

  return (
    <Section title="Load lock">
      {vacuum.dialog}
      <VStack align="stretch" spacing={2}>
        <Field label="TCG31 / IG3">
          <Text fontSize="xs" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {fmtTorr(chamber?.pressures?.tcg31)} / {chamber?.pressures?.ig3_on ? fmtTorr(chamber?.pressures?.ig3) : "off"}
          </Text>
        </Field>
        <Field label="Hatch closed">
          <BoolBadge value={ll?.hatch_closed} onLabel="yes" offLabel="no" />
        </Field>
        <Field label="GV1">
          <Text fontSize="xs">{ll?.gv1 ?? "—"}</Text>
        </Field>
        <Field label="Below SP1 / SP2">
          <HStack spacing={1} justify="flex-end">
            <BoolBadge value={ll?.below_sp1} onLabel="yes" offLabel="no" />
            <BoolBadge value={ll?.below_sp2} onLabel="yes" offLabel="no" />
          </HStack>
        </Field>
        <Field label="Sequence">
          <Text fontSize="xs">
            {ll?.sequence || "idle"}
            {ll?.step ? ` · ${ll.step}` : ""}
          </Text>
        </Field>
        <HStack justify="flex-end" spacing={2} flexWrap="wrap">
          <Button
            size="xs"
            colorScheme="blue"
            isDisabled={!vacuum.call.canOperate || vacuum.call.busy}
            title={operatorTitle(vacuum.call)}
            onClick={() => vacuum.ask({ kind: "vent" })}
          >
            Auto Vent
          </Button>
          <Button
            size="xs"
            colorScheme="blue"
            isDisabled={!vacuum.call.canOperate || vacuum.call.busy}
            title={operatorTitle(vacuum.call)}
            onClick={() => vacuum.ask({ kind: "vac" })}
          >
            Auto Vac
          </Button>
          <ConfirmOpButton
            call={vacuum.call}
            onReply={vacuum.setReply}
            confirmLabel="Stop the running Auto Vent / Auto Vac sequence?"
            op={(c) => c.cancel_load_lock()}
          >
            Cancel sequence
          </ConfirmOpButton>
        </HStack>
        <Group title="Pumps">
          <PumpRows names={LOAD_LOCK.pumps} vacuum={vacuum} />
        </Group>
        <ReplyText reply={vacuum.reply} align="left" />
        <Group title="Valves & gauge">
          <ValveRows names={LOAD_LOCK.valves} call={valveCall} onReply={setValveReply} />
          <GaugeRow gauge="IG3" call={valveCall} onReply={setValveReply} />
          <ReplyText reply={valveReply} align="left" />
        </Group>
        <Errors calls={[vacuum.call, valveCall]} />
      </VStack>
    </Section>
  );
};
