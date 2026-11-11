import {
  Button,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputRightAddon,
  Select,
  SimpleGrid,
  Spinner,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import { AddIcon, CloseIcon } from "@chakra-ui/icons";
import { LuPlay, LuSquare } from "react-icons/lu";

import ConfirmButton from "../Controller/ConfirmButton";
import { FieldSpec } from "./opRegistry";
import { NEW_STEP, OpFormState, StepRow } from "./useOpForm";

/** Carousel slots, offered bare when the loaded materials can't be read. */
const SLOTS = ["A", "B", "C", "D", "E", "F"];
const VIEWPORTS = ["Clear", "Monitor"];
const slotOrder = (id: string) => (VIEWPORTS.includes(id) ? 1 : 0);

/** Top-level scalars of whatever came back -- replies here have no common shape. */
const ReplySummary = ({ reply }: { reply: unknown }) => {
  if (reply == null || typeof reply !== "object") return null;
  const entries = Object.entries(reply as Record<string, unknown>).filter(
    ([, v]) => v !== null && ["string", "number", "boolean"].includes(typeof v)
  );
  const failed = (reply as { ok?: boolean }).ok === false;
  return (
    <Text fontSize="xs" color={failed ? "status.error" : "text.muted"} wordBreak="break-word">
      {entries.length === 0 ? "Done." : entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
    </Text>
  );
};

const FieldInput = ({
  field,
  value,
  onChange,
  targets,
}: {
  field: FieldSpec;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  targets: Record<string, string> | null;
}) => {
  let control;
  if (field.type === "boolean") {
    // Same label-above layout as the inputs, so a switch sits in their row.
    control = (
      <HStack h={6}>
        <Switch
          size="sm"
          aria-label={field.label}
          isChecked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </HStack>
    );
  } else if (field.type === "select" || field.type === "targets") {
    const options =
      field.type === "targets"
        ? (targets
            ? Object.keys(targets)
            : [...SLOTS, ...VIEWPORTS]
          )
            .filter((id) => field.viewports || !VIEWPORTS.includes(id))
            .sort((a, b) => slotOrder(a) - slotOrder(b) || a.localeCompare(b))
            .map((id) => {
              const name = targets?.[id];
              return { value: id, label: name && name !== id ? `${id} — ${name}` : id };
            })
        : field.options ?? [];
    control = (
      <Select
        size="xs"
        aria-label={field.label}
        placeholder={field.type === "targets" ? "choose a target" : undefined}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  } else {
    const numeric = field.type === "number" || field.type === "integer";
    const input = (
      <Input
        type={numeric ? "number" : "text"}
        step={field.type === "integer" ? 1 : field.step ?? "any"}
        aria-label={field.label}
        placeholder={field.optional ? "optional" : undefined}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
    control = (
      <InputGroup size="xs">
        {input}
        {field.unit && <InputRightAddon>{field.unit}</InputRightAddon>}
      </InputGroup>
    );
  }

  return (
    <VStack align="stretch" spacing="1px">
      <Text fontSize="0.65rem" color="text.muted">
        {field.label}
      </Text>
      {control}
    </VStack>
  );
};

const StepsInput = ({ steps, setSteps }: { steps: StepRow[]; setSteps: (s: StepRow[]) => void }) => {
  const update = (i: number, key: keyof StepRow, v: string) =>
    setSteps(steps.map((s, j) => (j === i ? { ...s, [key]: v } : s)));
  return (
    <VStack align="stretch" spacing={1}>
      {steps.map((s, i) => (
        <HStack key={i} spacing={1}>
          <Text fontSize="0.65rem" color="text.muted" w="14px">
            {i + 1}
          </Text>
          {(
            [
              ["temperature", "°C"],
              ["ramp_rate", "°C/min"],
              ["wait_time", "hold s"],
            ] as const
          ).map(([key, unit]) => (
            <InputGroup size="xs" key={key} minW={0}>
              <Input
                type="number"
                step="any"
                aria-label={`Step ${i + 1} ${key}`}
                value={s[key]}
                onChange={(e) => update(i, key, e.target.value)}
              />
              <InputRightAddon px={1}>{unit}</InputRightAddon>
            </InputGroup>
          ))}
          <IconButton
            size="xs"
            variant="ghost"
            aria-label={`Remove step ${i + 1}`}
            icon={<CloseIcon boxSize={2} />}
            isDisabled={steps.length === 1}
            onClick={() => setSteps(steps.filter((_, j) => j !== i))}
          />
        </HStack>
      ))}
      <Button
        size="xs"
        variant="ghost"
        leftIcon={<AddIcon boxSize={2} />}
        alignSelf="flex-start"
        onClick={() => setSteps([...steps, { ...NEW_STEP }])}
      >
        Add step
      </Button>
    </VStack>
  );
};

/** The play button, which turns into a stop button while the op runs. */
export const RunControl = ({ form }: { form: OpFormState }) => {
  const { op, running, stop } = form;
  if (running && stop) {
    return (
      <ConfirmButton
        size="xs"
        variant="ghost"
        color="status.error"
        minW={6}
        px={0}
        aria-label={`Stop ${op.label}`}
        title={`Stop ${op.label.toLowerCase()}`}
        isLoading={form.stopping}
        isDisabled={!form.canOperate}
        confirmLabel={`Stop this ${op.label.toLowerCase()} now? Pulses already fired are kept.`}
        onConfirm={stop}
      >
        <Icon as={LuSquare} boxSize={3.5} fill="currentColor" />
      </ConfirmButton>
    );
  }
  if (running) {
    return (
      <IconButton
        size="xs"
        variant="ghost"
        color="status.warn"
        aria-label={`${op.label} running`}
        title="Running -- this op has no stop; the driver finishes it"
        icon={<Spinner size="xs" boxSize={3.5} />}
        // Not isDisabled: that would grey the running color out.
        cursor="default"
      />
    );
  }
  return (
    <IconButton
      size="xs"
      variant="ghost"
      color={form.disabled ? "text.muted" : "status.ok"}
      aria-label={`Run ${op.label}`}
      title={form.title}
      icon={<Icon as={LuPlay} boxSize={3.5} fill="currentColor" />}
      isDisabled={form.disabled}
      onClick={form.run}
    />
  );
};

/** The fields of one op and what its last call returned. */
const OpForm = ({ form }: { form: OpFormState }) => {
  const { op, values, setValues, steps, setSteps, targets, targetsError } = form;
  const flat = op.fields.filter((f) => f.type !== "steps");
  const hasSteps = op.fields.some((f) => f.type === "steps");

  return (
    <VStack align="stretch" spacing={2}>
      {op.hint && (
        <Text fontSize="xs" color="text.muted">
          {op.hint}
        </Text>
      )}
      {flat.length > 0 && (
        <SimpleGrid minChildWidth="140px" spacing={2}>
          {flat.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={values[f.key]}
              targets={targets}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </SimpleGrid>
      )}
      {hasSteps && <StepsInput steps={steps} setSteps={setSteps} />}
      {targetsError && (
        <Text fontSize="xs" color="text.muted" noOfLines={2} title={targetsError}>
          Target materials unavailable, showing slots only: {targetsError}
        </Text>
      )}
      {form.error ? (
        <Text fontSize="xs" color="status.error" wordBreak="break-word">
          {form.error}
        </Text>
      ) : (
        <ReplySummary reply={form.reply} />
      )}
    </VStack>
  );
};

export default OpForm;
