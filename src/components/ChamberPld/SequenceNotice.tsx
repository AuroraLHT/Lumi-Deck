import { Alert, AlertIcon, Text } from "@chakra-ui/react";

import useChamberPldStore from "../../stores/chamberPld";
import useExperimentDriverNodeStore from "../../stores/nodes/experimentDriver";

/**
 * What a sequence means for the controls below. pld-service's own state
 * covers sequences any client started; the driver's run adds the sample it
 * grows on. Running, pld-service refuses every op here except Stop firing,
 * STOP motors (which cancels the run) and the RHEED all-offs. Paused, ops go through, and Lumi records what changed
 * between the pause and the resume, so a move here ends up in the run's
 * record. "unknown" is Lumi having lost track of a run.
 */
const SequenceNotice = () => {
  const seq = useChamberPldStore((s) => s.chamber?.sequence);
  const run = useExperimentDriverNodeStore((s) => s.state.sequence);
  const state = seq?.state ?? "";
  const name = seq?.name || run?.name || "A sequence";
  const step = seq?.step ? ` at step ${seq.step}/${seq.steps ?? "?"}` : "";
  const sample =
    run && run.name === seq?.name && !run.no_sample && run.substrate_id != null
      ? ` It is growing on ${run.sample_name ?? `substrate #${run.substrate_id}`}${
          run.pixel_index != null ? `, pixel ${run.pixel_index}` : ""
        }.`
      : "";

  if (state === "paused" || state === "pausing") {
    return (
      <Alert status="warning" borderRadius="md" fontSize="xs" py={2}>
        <AlertIcon />
        <Text>
          {name} is {state}
          {step}.{sample} Moving the mask, target, sample or shutter here changes what the run resumes into; Lumi
          records the change, but the run doesn't undo it. Put things back before resuming unless you mean it.
        </Text>
      </Alert>
    );
  }
  if (state === "running") {
    return (
      <Alert status="info" borderRadius="md" fontSize="xs" py={2}>
        <AlertIcon />
        <Text>
          {name} is running{step}: pld-service refuses the controls below except Stop firing, STOP motors (which cancels the run) and the RHEED all-offs.
          Pause or cancel it in the Experiment Driver.
        </Text>
      </Alert>
    );
  }
  if (run?.state === "unknown") {
    return (
      <Alert status="error" borderRadius="md" fontSize="xs" py={2}>
        <AlertIcon />
        <Text>
          Lumi lost track of {run.name} v{run.version} (pld-service stopped answering or restarted). Check the chamber
          before doing anything else.
        </Text>
      </Alert>
    );
  }
  return null;
};

export default SequenceNotice;
