import { ReactNode, useEffect, useState } from "react";
import { Box, Button, HStack, Input, Select, Switch, Text, VStack } from "@chakra-ui/react";

import { ChamberPldClient } from "../../generated/lumi";
import useChamberPldCall from "../../hooks/useChamberPldCall";
import ConfirmButton from "../Controller/ConfirmButton";

export type Call = ReturnType<typeof useChamberPldCall>;

/**
 * Every pld reply carries `message`; most carry `ok`, `acquire_control` /
 * `release_control` carry `granted` instead. Either marks a refusal.
 */
export type AnyReply = { message?: string; ok?: boolean; granted?: boolean };

const isRefusal = (reply: AnyReply) => reply.ok === false || reply.granted === false;

/** How long a reply stays under its control: long enough to read, short enough not to outlive the state it describes. */
const REPLY_OK_MS = 8000;
const REPLY_REFUSED_MS = 30000;

/**
 * The last reply a control got. It clears itself -- a success sooner than a
 * refusal -- since a reply describes the moment it came back ("filament on at
 * 507 mA, held there") and reads as wrong once the state has moved on.
 */
export const useReply = () => {
  const [reply, setReply] = useState<AnyReply | null>(null);
  useEffect(() => {
    if (!reply?.message) return;
    const timer = setTimeout(() => setReply(null), isRefusal(reply) ? REPLY_REFUSED_MS : REPLY_OK_MS);
    return () => clearTimeout(timer);
  }, [reply]);
  return [reply, setReply] as const;
};

/**
 * Where a control's reply goes. By default the control shows it under itself;
 * a section that lays its controls out in rows can take it with `onReply` and
 * show it full width instead.
 */
const useReplyTarget = (onReply?: (reply: AnyReply | null) => void) => {
  const [reply, setReply] = useReply();
  const deliver = (r: AnyReply | null | undefined) => (onReply ? onReply(r ?? null) : setReply(r ?? null));
  return [onReply ? null : reply, deliver] as const;
};

/** The last reply a control got, as feedback under it -- a refusal is a normal reply, not an exception. */
export const ReplyText = ({ reply, align }: { reply: AnyReply | null; align?: "left" | "right" }) =>
  reply?.message ? (
    <Text fontSize="0.65rem" lineHeight="short" textAlign={align} color={isRefusal(reply) ? "status.error" : "text.muted"}>
      {reply.message}
    </Text>
  ) : null;

export const operatorTitle = (call: Call, title?: string) =>
  !call.canOperate ? "Operator access required" : title;

/** A button that fires a mutate op and shows the reply it got back. */
export const OpButton = <T extends AnyReply>({
  children,
  call,
  op,
  colorScheme,
  variant,
  isDisabled,
  title,
  onReply,
}: {
  children: ReactNode;
  call: Call;
  op: (client: ChamberPldClient) => Promise<T>;
  colorScheme?: string;
  variant?: string;
  isDisabled?: boolean;
  title?: string;
  /** Takes the reply instead of showing it under the control. */
  onReply?: (reply: AnyReply | null) => void;
}) => {
  const [reply, setReply] = useReplyTarget(onReply);
  return (
    <Box>
      <Button
        size="xs"
        colorScheme={colorScheme}
        variant={variant}
        isLoading={call.busy}
        isDisabled={!call.canOperate || isDisabled}
        title={operatorTitle(call, title)}
        onClick={() => call.run(op).then(setReply)}
      >
        {children}
      </Button>
      <ReplyText reply={reply} />
    </Box>
  );
};

/** Like `OpButton`, but needs an explicit second click -- for ops that act regardless of who, if anyone, holds control. */
export const ConfirmOpButton = <T extends AnyReply>({
  children,
  call,
  op,
  confirmLabel,
  colorScheme = "red",
  variant,
  isDisabled,
  onReply,
}: {
  children: ReactNode;
  call: Call;
  op: (client: ChamberPldClient) => Promise<T>;
  confirmLabel: string;
  colorScheme?: string;
  variant?: string;
  isDisabled?: boolean;
  /** Takes the reply instead of showing it under the control. */
  onReply?: (reply: AnyReply | null) => void;
}) => {
  const [reply, setReply] = useReplyTarget(onReply);
  return (
    <Box>
      <ConfirmButton
        size="xs"
        colorScheme={colorScheme}
        variant={variant}
        isDisabled={!call.canOperate || isDisabled}
        confirmLabel={confirmLabel}
        onConfirm={() => call.run(op).then(setReply)}
      >
        {children}
      </ConfirmButton>
      <ReplyText reply={reply} />
    </Box>
  );
};

/** A number field plus the button that sends it. */
export const NumberOp = <T extends AnyReply>({
  call,
  label,
  unit,
  initial = "",
  action,
  op,
  step,
  min,
  max,
  integer,
  clearAfterSend,
  isDisabled,
  title,
  onReply,
}: {
  call: Call;
  label: string;
  unit?: string;
  initial?: string;
  action: string;
  op: (client: ChamberPldClient, value: number) => Promise<T>;
  /** Disables the field and its button (e.g. the device refuses the op right now). */
  isDisabled?: boolean;
  title?: string;
  step?: number;
  /** Bounds the value; outside them the button stays disabled. */
  min?: number | null;
  max?: number | null;
  /** Whole numbers only (e.g. motor steps); anything else keeps the button disabled. */
  integer?: boolean;
  /**
   * Empty the field once the op is sent -- for relative moves, where a second
   * click (or a double click) would move as far again rather than repeat a
   * harmless absolute target.
   */
  clearAfterSend?: boolean;
  /** Takes the reply instead of showing it under the control. */
  onReply?: (reply: AnyReply | null) => void;
}) => {
  const [value, setValue] = useState(initial);
  const [reply, setReply] = useReplyTarget(onReply);
  const n = Number(value);
  const inRange = (min == null || n >= min) && (max == null || n <= max) && (!integer || Number.isInteger(n));
  const valid = value.trim() !== "" && Number.isFinite(n) && inRange;
  return (
    <VStack align="stretch" spacing="1px">
      <HStack spacing={1}>
        <Input
          size="xs"
          type="number"
          w="76px"
          step={step}
          min={min ?? undefined}
          max={max ?? undefined}
          isInvalid={value.trim() !== "" && !inRange}
          isDisabled={isDisabled}
          aria-label={label}
          placeholder={unit}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="xs"
          minW="48px"
          isLoading={call.busy}
          isDisabled={!call.canOperate || !valid || isDisabled}
          title={operatorTitle(call, title)}
          onClick={() => {
            if (clearAfterSend) setValue("");
            call.run((c) => op(c, n)).then(setReply);
          }}
        >
          {action}
        </Button>
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};

/** Two number fields plus the button that sends them -- for paired limits. */
export const TwoNumberOp = <T extends AnyReply>({
  call,
  labelA,
  labelB,
  unitA,
  unitB,
  initialA = "",
  initialB = "",
  minA,
  maxA,
  minB,
  maxB,
  action,
  op,
  onReply,
}: {
  call: Call;
  labelA: string;
  labelB: string;
  unitA?: string;
  unitB?: string;
  initialA?: string;
  initialB?: string;
  /** Inclusive bounds; out of range the input is marked invalid and the button stays disabled. */
  minA?: number | null;
  maxA?: number | null;
  minB?: number | null;
  maxB?: number | null;
  action: string;
  op: (client: ChamberPldClient, a: number, b: number) => Promise<T>;
  /** Takes the reply instead of showing it under the control. */
  onReply?: (reply: AnyReply | null) => void;
}) => {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [reply, setReply] = useReplyTarget(onReply);
  const na = Number(a);
  const nb = Number(b);
  const inA = (minA == null || na >= minA) && (maxA == null || na <= maxA);
  const inB = (minB == null || nb >= minB) && (maxB == null || nb <= maxB);
  const valid = a.trim() !== "" && b.trim() !== "" && Number.isFinite(na) && Number.isFinite(nb) && inA && inB;
  return (
    <VStack align="stretch" spacing="1px">
      <HStack spacing={1}>
        <Input
          size="xs"
          type="number"
          w="64px"
          aria-label={labelA}
          placeholder={unitA}
          title={rangeTitle(minA, maxA, unitA)}
          value={a}
          isInvalid={a.trim() !== "" && !inA}
          onChange={(e) => setA(e.target.value)}
        />
        <Input
          size="xs"
          type="number"
          w="64px"
          aria-label={labelB}
          placeholder={unitB}
          title={rangeTitle(minB, maxB, unitB)}
          value={b}
          isInvalid={b.trim() !== "" && !inB}
          onChange={(e) => setB(e.target.value)}
        />
        <Button
          size="xs"
          minW="48px"
          isLoading={call.busy}
          isDisabled={!call.canOperate || !valid}
          title={operatorTitle(call)}
          onClick={() => call.run((c) => op(c, na, nb)).then(setReply)}
        >
          {action}
        </Button>
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};

const rangeTitle = (min?: number | null, max?: number | null, unit?: string) =>
  min == null && max == null
    ? undefined
    : min == null
    ? `At most ${max} ${unit ?? ""}`.trim()
    : max == null
    ? `At least ${min} ${unit ?? ""}`.trim()
    : `${min} to ${max} ${unit ?? ""}`.trim();

/** A switch that fires the op on every toggle; it reflects the last reply, not an optimistic guess. */
export const SwitchOp = <T extends AnyReply>({
  call,
  label,
  checked,
  op,
  ariaLabel,
  isDisabled,
  title,
  onReply,
}: {
  call: Call;
  label: string;
  checked: boolean;
  op: (client: ChamberPldClient, on: boolean) => Promise<T>;
  /** Names the switch when `label` is empty because a Field beside it says what it is. */
  ariaLabel?: string;
  isDisabled?: boolean;
  title?: string;
  /** Takes the reply instead of showing it under the control. */
  onReply?: (reply: AnyReply | null) => void;
}) => {
  const [reply, setReply] = useReplyTarget(onReply);
  return (
    <VStack align="stretch" spacing="1px">
      <HStack justify="space-between" spacing={2}>
        {label && (
          <Text fontSize="xs" color="text.muted">
            {label}
          </Text>
        )}
        <Switch
          size="sm"
          aria-label={ariaLabel || label || undefined}
          isChecked={checked}
          isDisabled={!call.canOperate || call.busy || isDisabled}
          title={operatorTitle(call, title)}
          onChange={(e) => call.run((c) => op(c, e.target.checked)).then(setReply)}
        />
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};

/** A select plus the button that sends the chosen option. */
export const SelectOp = <T extends AnyReply>({
  call,
  label,
  options,
  initial,
  action,
  op,
  onReply,
}: {
  call: Call;
  label: string;
  options: { value: string; label: string }[];
  initial?: string;
  action: string;
  op: (client: ChamberPldClient, value: string) => Promise<T>;
  /** Takes the reply instead of showing it under the control. */
  onReply?: (reply: AnyReply | null) => void;
}) => {
  const [value, setValue] = useState(initial ?? options[0]?.value ?? "");
  const [reply, setReply] = useReplyTarget(onReply);
  return (
    <VStack align="stretch" spacing="1px">
      <HStack spacing={1}>
        <Select size="xs" aria-label={label} value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          size="xs"
          flexShrink={0}
          isLoading={call.busy}
          isDisabled={!call.canOperate}
          title={operatorTitle(call)}
          onClick={() => call.run((c) => op(c, value)).then(setReply)}
        >
          {action}
        </Button>
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};
