import { useMemo } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Grid,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuCheckCircle, LuCircleDashed, LuXCircle } from "react-icons/lu";

import { StepInfo } from "../../generated/lumi";
import { useSampleSteps } from "../../hooks/useHistory";
import { formatDay, formatDuration, formatTime, sessionsOf, stepLabel } from "./history";

const StepStatus = ({ ok }: { ok: boolean | null | undefined }) =>
  ok === true ? (
    <Icon as={LuCheckCircle} color="status.ok" aria-label="Succeeded" />
  ) : ok === false ? (
    <Icon as={LuXCircle} color="status.error" aria-label="Failed" />
  ) : (
    <Icon as={LuCircleDashed} color="text.muted" aria-label="No outcome recorded" />
  );

const valueText = (value: unknown) =>
  value === null || value === undefined
    ? "--"
    : typeof value === "object"
    ? JSON.stringify(value)
    : String(value);

const Fields = ({ title, fields }: { title: string; fields: Record<string, unknown> | undefined }) => {
  const entries = Object.entries(fields ?? {});
  if (!entries.length) return null;
  return (
    <Box>
      <Text fontSize="xs" fontWeight="700" color="text.secondary" mb={1}>
        {title}
      </Text>
      <Grid templateColumns="max-content 1fr" columnGap={3} rowGap={0.5} fontSize="xs">
        {entries.map(([key, value]) => (
          <Box key={key} display="contents">
            <Text color="text.muted" fontFamily="mono">
              {key}
            </Text>
            <Text fontFamily="mono" wordBreak="break-all">
              {valueText(value)}
            </Text>
          </Box>
        ))}
      </Grid>
    </Box>
  );
};

const StepRow = ({ step }: { step: StepInfo }) => {
  const duration =
    step.ended_at != null && step.started_at != null ? step.ended_at - step.started_at : null;
  return (
    <AccordionItem border="none">
      <AccordionButton px={2} py={1.5} borderRadius="md" _hover={{ bg: "panel.header" }}>
        <Grid
          templateColumns="72px 18px 1fr auto"
          columnGap={2}
          alignItems="center"
          flex={1}
          textAlign="left"
          fontSize="sm"
        >
          <Text color="text.muted" fontFamily="mono" fontSize="xs">
            {formatTime(step.started_at, false)}
          </Text>
          <StepStatus ok={step.ok} />
          <Box minW={0}>
            <Text fontWeight="500" noOfLines={1}>
              {stepLabel(step.kind)}
            </Text>
            {step.error && (
              <Text fontSize="xs" color="status.error" noOfLines={2}>
                {step.error}
              </Text>
            )}
          </Box>
          <HStack spacing={3} fontSize="xs" color="text.muted">
            {step.actor && <Text display={{ base: "none", md: "block" }}>{step.actor}</Text>}
            <Text minW="48px" textAlign="right">
              {formatDuration(duration)}
            </Text>
          </HStack>
        </Grid>
        <AccordionIcon ml={2} color="text.muted" />
      </AccordionButton>
      <AccordionPanel pl="100px" pr={2} pt={1} pb={3}>
        <VStack align="stretch" spacing={2}>
          <Fields title="Parameters" fields={step.params} />
          <Fields title="Result" fields={step.result} />
          <Text fontSize="xs" color="text.muted">
            Step {step.step_id}
            {step.parent_step_id != null && ` · after step ${step.parent_step_id}`}
            {step.source && ` · via ${step.source}`}
            {step.ended_at != null && ` · ended ${formatTime(step.ended_at, false)}`}
          </Text>
        </VStack>
      </AccordionPanel>
    </AccordionItem>
  );
};

/**
 * The step journal for one sample, in the order it ran: every driver op that
 * touched it, with what it was asked, what came back and who asked. Split
 * into working sessions, since a sample grown in layers is often grown over
 * several days.
 */
const ProcessTimeline = ({ sampleId }: { sampleId: number }) => {
  const steps = useSampleSteps(sampleId);
  const sessions = useMemo(() => sessionsOf(steps.data?.steps ?? []), [steps.data]);

  if (!steps.nodeUp) return <Text color="text.muted">The experiment node is not running.</Text>;
  if (steps.isPending) return <Spinner size="sm" />;
  if (steps.isError) return <Text color="status.error">{steps.error.message}</Text>;
  if (!sessions.length)
    return <Text color="text.muted">No steps recorded for this sample.</Text>;

  const page = steps.data.page;
  const failed = steps.data.steps?.filter((s) => s.ok === false).length ?? 0;

  return (
    <VStack align="stretch" spacing={5}>
      <Text fontSize="sm" color="text.secondary">
        {steps.data.steps?.length} steps in {sessions.length} session
        {sessions.length === 1 ? "" : "s"}
        {failed > 0 && (
          <Text as="span" color="status.error">
            {" "}
            · {failed} failed
          </Text>
        )}
        {page?.has_more && ` · showing the first ${steps.data.steps?.length} of ${page.total}`}
      </Text>
      {sessions.map((session) => (
        <Box key={session.start}>
          <HStack
            justify="space-between"
            borderBottom="1px solid"
            borderColor="panel.border"
            pb={1}
            mb={1}
          >
            <Text fontSize="sm" fontWeight="700">
              {formatDay(session.start)}
            </Text>
            <Text fontSize="xs" color="text.muted">
              {formatTime(session.start, false)} – {formatTime(session.end, false)} (
              {formatDuration(session.end - session.start)})
            </Text>
          </HStack>
          <Accordion allowMultiple>
            {session.steps.map((step) => (
              <StepRow key={step.step_id} step={step} />
            ))}
          </Accordion>
        </Box>
      ))}
    </VStack>
  );
};

export default ProcessTimeline;
