import { ReactNode, useState } from "react";
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

/** The last reply a control got, as feedback under it -- a refusal is a normal reply, not an exception. */
export const ReplyText = ({ reply }: { reply: AnyReply | null }) =>
  reply?.message ? (
    <Text fontSize="0.65rem" color={isRefusal(reply) ? "status.error" : "text.muted"}>
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
}: {
  children: ReactNode;
  call: Call;
  op: (client: ChamberPldClient) => Promise<T>;
  colorScheme?: string;
  variant?: string;
  isDisabled?: boolean;
  title?: string;
}) => {
  const [reply, setReply] = useState<AnyReply | null>(null);
  return (
    <Box>
      <Button
        size="xs"
        colorScheme={colorScheme}
        variant={variant}
        isLoading={call.busy}
        isDisabled={!call.canOperate || isDisabled}
        title={operatorTitle(call, title)}
        onClick={() => call.run(op).then((r) => setReply(r ?? null))}
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
}: {
  children: ReactNode;
  call: Call;
  op: (client: ChamberPldClient) => Promise<T>;
  confirmLabel: string;
  colorScheme?: string;
  variant?: string;
  isDisabled?: boolean;
}) => {
  const [reply, setReply] = useState<AnyReply | null>(null);
  return (
    <Box>
      <ConfirmButton
        size="xs"
        colorScheme={colorScheme}
        variant={variant}
        isDisabled={!call.canOperate || isDisabled}
        confirmLabel={confirmLabel}
        onConfirm={() => call.run(op).then((r) => setReply(r ?? null))}
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
}: {
  call: Call;
  label: string;
  unit?: string;
  initial?: string;
  action: string;
  op: (client: ChamberPldClient, value: number) => Promise<T>;
  step?: number;
}) => {
  const [value, setValue] = useState(initial);
  const [reply, setReply] = useState<AnyReply | null>(null);
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n);
  return (
    <VStack align="stretch" spacing="1px">
      <HStack spacing={1}>
        <Input
          size="xs"
          type="number"
          w="76px"
          step={step}
          aria-label={label}
          placeholder={unit}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="xs"
          isLoading={call.busy}
          isDisabled={!call.canOperate || !valid}
          title={operatorTitle(call)}
          onClick={() => call.run((c) => op(c, n)).then((r) => setReply(r ?? null))}
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
  action,
  op,
}: {
  call: Call;
  labelA: string;
  labelB: string;
  unitA?: string;
  unitB?: string;
  initialA?: string;
  initialB?: string;
  action: string;
  op: (client: ChamberPldClient, a: number, b: number) => Promise<T>;
}) => {
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [reply, setReply] = useState<AnyReply | null>(null);
  const na = Number(a);
  const nb = Number(b);
  const valid = a.trim() !== "" && b.trim() !== "" && Number.isFinite(na) && Number.isFinite(nb);
  return (
    <VStack align="stretch" spacing="1px">
      <HStack spacing={1}>
        <Input
          size="xs"
          type="number"
          w="64px"
          aria-label={labelA}
          placeholder={unitA}
          value={a}
          onChange={(e) => setA(e.target.value)}
        />
        <Input
          size="xs"
          type="number"
          w="64px"
          aria-label={labelB}
          placeholder={unitB}
          value={b}
          onChange={(e) => setB(e.target.value)}
        />
        <Button
          size="xs"
          isLoading={call.busy}
          isDisabled={!call.canOperate || !valid}
          title={operatorTitle(call)}
          onClick={() => call.run((c) => op(c, na, nb)).then((r) => setReply(r ?? null))}
        >
          {action}
        </Button>
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};

/** A switch that fires the op on every toggle; it reflects the last reply, not an optimistic guess. */
export const SwitchOp = <T extends AnyReply>({
  call,
  label,
  checked,
  op,
}: {
  call: Call;
  label: string;
  checked: boolean;
  op: (client: ChamberPldClient, on: boolean) => Promise<T>;
}) => {
  const [reply, setReply] = useState<AnyReply | null>(null);
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
          isChecked={checked}
          isDisabled={!call.canOperate || call.busy}
          title={operatorTitle(call)}
          onChange={(e) => call.run((c) => op(c, e.target.checked)).then((r) => setReply(r ?? null))}
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
}: {
  call: Call;
  label: string;
  options: { value: string; label: string }[];
  initial?: string;
  action: string;
  op: (client: ChamberPldClient, value: string) => Promise<T>;
}) => {
  const [value, setValue] = useState(initial ?? options[0]?.value ?? "");
  const [reply, setReply] = useState<AnyReply | null>(null);
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
          onClick={() => call.run((c) => op(c, value)).then((r) => setReply(r ?? null))}
        >
          {action}
        </Button>
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};
