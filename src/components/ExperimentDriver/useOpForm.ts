import { useEffect, useState } from "react";

import { ExperimentDriverClient } from "../../generated/lumi";
import useTransportStore from "../../clients/transport";
import useDriverCall, { errorText } from "../../hooks/useDriverCall";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";
import { OP_REGISTRY, OpSpec, Payload } from "./opRegistry";

export type Values = Record<string, string | boolean>;
export interface StepRow {
  temperature: string;
  ramp_rate: string;
  wait_time: string;
}

export const NEW_STEP: StepRow = { temperature: "", ramp_rate: "20", wait_time: "0" };

const initialValues = (op: OpSpec): Values =>
  Object.fromEntries(
    op.fields
      .filter((f) => f.type !== "steps")
      .map((f) => [f.key, f.initial ?? (f.type === "boolean" ? false : "")])
  );

const parseNumber = (raw: string, integer: boolean) => {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && (!integer || Number.isInteger(n)) ? n : null;
};

/**
 * Values -> the request body, plus the labels of fields that are missing or
 * malformed. Blank optional fields are left out so the backend default
 * applies rather than an empty string or zero.
 */
const buildPayload = (op: OpSpec, values: Values, steps: StepRow[]) => {
  const payload: Payload = {};
  const invalid: string[] = [];
  for (const f of op.fields) {
    if (f.type === "steps") {
      const parsed = steps.map((s) => ({
        temperature: parseNumber(s.temperature, false),
        ramp_rate: parseNumber(s.ramp_rate, false),
        wait_time: parseNumber(s.wait_time, false),
      }));
      if (parsed.length === 0 || parsed.some((s) => s.temperature == null || s.ramp_rate == null || s.wait_time == null)) {
        invalid.push(f.label);
      }
      payload[f.key] = parsed;
      continue;
    }
    const v = values[f.key];
    if (f.type === "boolean") {
      payload[f.key] = Boolean(v);
      continue;
    }
    const raw = String(v ?? "").trim();
    if (raw === "") {
      if (!f.optional) invalid.push(f.label);
      continue;
    }
    if (f.type === "number" || f.type === "integer") {
      const n = parseNumber(raw, f.type === "integer");
      if (n == null) invalid.push(f.label);
      else payload[f.key] = n;
    } else if (f.type === "numberList") {
      const parts = raw.split(",").map((p) => parseNumber(p, false));
      if (parts.some((p) => p == null)) invalid.push(f.label);
      else payload[f.key] = parts;
    } else {
      payload[f.key] = raw;
    }
  }
  return { payload, invalid };
};

/** `show_available_targets`, fetched once per op that picks a target: slot -> loaded material. */
const useAvailableTargets = (enabled: boolean) => {
  const transport = useTransportStore((s) => s.transport);
  const [targets, setTargets] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !transport) return;
    let cancelled = false;
    new ExperimentDriverClient(transport)
      .show_available_targets()
      .then((r) => !cancelled && setTargets(r.targets ?? {}))
      .catch((err) => !cancelled && setError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [enabled, transport]);
  return { targets, error };
};

const taskName = (kind: string) =>
  OP_REGISTRY.find((o) => o.id === kind)?.label ?? kind.replace(/_/g, " ");

/**
 * One op's form state and its run/stop actions, shared by the card's header
 * (the play/stop button) and its body (the fields and the reply). Mount the
 * card keyed by op id so each op starts from its own defaults.
 */
const useOpForm = (op: OpSpec, locked: boolean) => {
  const call = useDriverCall();
  const stopCall = useDriverCall();
  const task = useExperimentDriverNodeStore((s) => s.state.current_task);
  const [values, setValues] = useState<Values>(() => initialValues(op));
  const [steps, setSteps] = useState<StepRow[]>([{ ...NEW_STEP }]);
  const [reply, setReply] = useState<unknown>(null);

  const needsTargets = op.fields.some((f) => f.type === "targets");
  const { targets, error: targetsError } = useAvailableTargets(needsTargets);

  const { payload, invalid } = buildPayload(op, values, steps);
  const blocked = Boolean(op.opensPrompt && locked);
  // Another task holds the driver; this op's own task shows as running instead.
  const busyWith = op.startsTask && task && task.kind !== op.id ? task.kind : null;
  const disabled = !call.canOperate || blocked || busyWith != null || invalid.length > 0;
  const title = !call.canOperate
    ? "Operator access required"
    : busyWith
    ? `${taskName(busyWith)} is running -- wait for it to finish or stop it first`
    : blocked
    ? "The driver is waiting on a prompt or running a task -- finish or cancel it first"
    : invalid.length > 0
    ? `Fill in: ${invalid.join(", ")}`
    : `Run ${op.label.toLowerCase()}`;

  // Running: the call itself is in flight, or it started a driver task of
  // this kind that has not finished -- possibly from another console.
  const running = call.busy || task?.kind === op.id;

  const run = () => {
    if (disabled || running) return;
    setReply(null);
    call.run((c) => op.run(c, payload)).then((r) => setReply(r ?? null));
  };
  const stop = op.stop
    ? async () => {
        const r = await stopCall.run((c) => op.stop!(c));
        if (r != null) setReply(r);
      }
    : undefined;

  return {
    op,
    values,
    setValues,
    steps,
    setSteps,
    targets,
    targetsError,
    reply,
    error: call.error ?? stopCall.error,
    canOperate: call.canOperate,
    disabled,
    title,
    running,
    stopping: stopCall.busy,
    run,
    stop,
  };
};

export type OpFormState = ReturnType<typeof useOpForm>;

export default useOpForm;
