import { useState } from "react";
import { Button, HStack, Input, Select, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldStore from "../../stores/chamberPld";
import { Field } from "./primitives";
import { Call, NumberOp, OpButton, ReplyText, SwitchOp, TwoNumberOp, operatorTitle, useReply } from "./controlPrimitives";

const GAUGE_OPTIONS = [
  { value: "", label: "(auto)" },
  { value: "IG1", label: "IG1" },
  { value: "CDG10", label: "CDG10" },
  { value: "CDG11", label: "CDG11" },
];

/**
 * The setpoint alone picks the regime (low: IG1/flow table, <= 2e-4 Torr;
 * high: CDG/PID, >= 3e-3 Torr) -- a setpoint between them is refused, so the
 * gauge picker is advisory, not a regime override.
 */
const SetPressureRow = ({ call }: { call: Call }) => {
  const [torr, setTorr] = useState("");
  const [gauge, setGauge] = useState("");
  const [reply, setReply] = useReply();
  const n = Number(torr);
  const valid = torr.trim() !== "" && Number.isFinite(n);
  return (
    <VStack align="stretch" spacing="1px">
      <HStack spacing={1}>
        <Input
          size="xs"
          type="number"
          w="76px"
          aria-label="Pressure setpoint"
          placeholder="Torr"
          value={torr}
          onChange={(e) => setTorr(e.target.value)}
        />
        <Select size="xs" w="90px" aria-label="Gauge" value={gauge} onChange={(e) => setGauge(e.target.value)}>
          {GAUGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          size="xs"
          isLoading={call.busy}
          isDisabled={!call.canOperate || !valid}
          title={operatorTitle(call)}
          onClick={() =>
            call
              .run((c) =>
                c.set_pressure({
                  torr: n,
                  gauge: gauge as "" | "IG1" | "CDG10" | "CDG11",
                  wait: false,
                })
              )
              .then((r) => setReply(r ?? null))
          }
        >
          Set
        </Button>
      </HStack>
      <ReplyText reply={reply} />
    </VStack>
  );
};

/**
 * MFC1 flow and the main chamber's pressure-control loop and its limits, as
 * fields for the Main chamber section (the ion gauges are with its vacuum).
 */
const GasFields = () => {
  const call = useChamberPldCall();
  const gas = useChamberPldStore((s) => s.chamber)?.gas;

  return (
      <VStack align="stretch" spacing={2}>
        <Field label="MFC1 setpoint (sccm)">
          <NumberOp
            call={call}
            label="MFC1 setpoint"
            unit="sccm"
            action="Set"
            step={0.1}
            op={(c, sccm) => c.set_mfc_flow({ mfc: 1, sccm })}
          />
        </Field>
        <Field label="Pressure control">
          <SwitchOp
            call={call}
            label=""
            checked={Boolean(gas?.pressure_control)}
            op={(c, on) => c.set_pressure_control({ on })}
          />
        </Field>
        <Field label="Pressure setpoint">
          <SetPressureRow call={call} />
        </Field>
        <Field label="Flow limits (sccm)">
          <TwoNumberOp
            call={call}
            labelA="Min flow"
            labelB="Max flow"
            unitA="min sccm"
            unitB="max sccm"
            action="Set"
            op={(c, min_sccm, max_sccm) => c.set_pressure_flow_limits({ min_sccm, max_sccm })}
          />
        </Field>
        <Field label="Auto-tune high-regime PID">
          <OpButton call={call} op={(c) => c.tune_pressure({ on: true })}>
            Start
          </OpButton>
        </Field>
        <Field label="Cancel auto-tune">
          <OpButton call={call} variant="outline" op={(c) => c.tune_pressure({ on: false })}>
            Cancel
          </OpButton>
        </Field>
        {call.error && (
          <Text fontSize="xs" color="status.error">
            {call.error}
          </Text>
        )}
      </VStack>
  );
};

export default GasFields;
