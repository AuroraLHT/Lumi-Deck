import { useState } from "react";
import { Button, HStack, Input, Text, VStack } from "@chakra-ui/react";

import useChamberPldCall from "../../hooks/useChamberPldCall";
import useChamberPldNodeStore from "../../stores/nodes/chamberPld";
import { Field, Section, TruncatedText } from "./primitives";
import { AnyReply, ConfirmOpButton, OpButton, ReplyText, operatorTitle } from "./controlPrimitives";

/**
 * Who holds chamber control, plus the growth-log CSV -- the two things that
 * span every other section rather than belonging to one piece of hardware.
 *
 * Most mutate ops below need control first; `acquire_control` takes it as
 * this node's client ('lumi-pascal') the same way any op would, so this button
 * is mainly useful to see who holds it today, or to force it away from
 * another client (hence the confirm -- the service logs a forced takeover).
 */
const SessionControls = () => {
  const call = useChamberPldCall();
  const node = useChamberPldNodeStore((s) => s.state);

  const [fileName, setFileName] = useState("");
  const [intervalS, setIntervalS] = useState("");
  const [logReply, setLogReply] = useState<AnyReply | null>(null);
  const interval = intervalS.trim() === "" ? undefined : Number(intervalS);

  return (
    <Section title="Control">
      <VStack align="stretch" spacing={2}>
        <Field label="Controller">
          <Text fontSize="xs">
            {node.controller ? node.controller : "nobody"}
            {node.holds_control && " (this console)"}
          </Text>
        </Field>
        <HStack spacing={2} flexWrap="wrap">
          <OpButton call={call} colorScheme="blue" op={(c) => c.acquire_control({})}>
            Acquire control
          </OpButton>
          <OpButton call={call} variant="outline" op={(c) => c.release_control()}>
            Release control
          </OpButton>
          <ConfirmOpButton
            call={call}
            confirmLabel={`Take control from ${node.controller || "the other client"}?`}
            isDisabled={!node.controller || node.holds_control}
            op={(c) => c.acquire_control({ force: true })}
          >
            Force
          </ConfirmOpButton>
        </HStack>
        {call.error && (
          <Text fontSize="xs" color="status.error">
            {call.error}
          </Text>
        )}

        <Field label="Growth log">
          {node.log_file ? (
            <TruncatedText text={node.log_file} />
          ) : (
            <Text fontSize="xs" color="text.muted">
              not logging
            </Text>
          )}
        </Field>
        <HStack spacing={1} flexWrap="wrap">
          <Input
            size="xs"
            w="140px"
            placeholder="file name (optional)"
            aria-label="Log file name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
          <Input
            size="xs"
            type="number"
            w="90px"
            placeholder="interval s"
            aria-label="Log interval seconds"
            value={intervalS}
            onChange={(e) => setIntervalS(e.target.value)}
          />
          <Button
            size="xs"
            isLoading={call.busy}
            isDisabled={!call.canOperate}
            title={operatorTitle(call)}
            onClick={() =>
              call
                .run((c) =>
                  c.start_logging({
                    file_name: fileName.trim() === "" ? null : fileName.trim(),
                    interval_s: interval,
                  })
                )
                .then((r) => setLogReply(r ?? null))
            }
          >
            Start logging
          </Button>
          <Button
            size="xs"
            variant="outline"
            isLoading={call.busy}
            isDisabled={!call.canOperate}
            title={operatorTitle(call)}
            onClick={() => call.run((c) => c.stop_logging()).then((r) => setLogReply(r ?? null))}
          >
            Stop logging
          </Button>
        </HStack>
        <ReplyText reply={logReply} />
      </VStack>
    </Section>
  );
};

export default SessionControls;
