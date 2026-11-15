import { Badge, Box, Flex, Spinner, Text, VStack } from "@chakra-ui/react";

import { PldActivity } from "../../generated/lumi";
import useChamberPldStore from "../../stores/chamberPld";
import { RHEED_GUN_OPS, actorLabel, describeOp, isAgent, outcome, timeOfDay } from "./activity";

const TABULAR = { fontVariantNumeric: "tabular-nums" };

/** Who asked, as a badge: purple for the agent, so its actions stand out from the operators'. */
export const ActorBadge = ({ actor }: { actor: string | null | undefined }) => (
  <Badge
    variant={isAgent(actor) ? "solid" : "subtle"}
    colorScheme={isAgent(actor) ? "purple" : "gray"}
    fontSize="0.6rem"
    textTransform="none"
    flexShrink={0}
    title={actor ?? "The caller did not say who it was"}
  >
    {actorLabel(actor)}
  </Badge>
);

const OutcomeText = ({ entry }: { entry: PldActivity }) =>
  entry.running ? (
    <Flex align="center" gap={1} color="status.warn" flexShrink={0}>
      <Spinner size="xs" />
      <Text fontSize="xs">running</Text>
    </Flex>
  ) : (
    <Text fontSize="xs" flexShrink={0} color={entry.ok === false ? "status.error" : "text.muted"} sx={TABULAR}>
      {outcome(entry)}
    </Text>
  );

/** One op: when, who, what, and how it ended; a refusal's reason under it. */
const ActivityRow = ({ entry }: { entry: PldActivity }) => (
  <Box py="3px" borderBottomWidth="1px" borderColor="panel.border" _last={{ borderBottomWidth: 0 }}>
    <Flex align="center" gap={2} fontSize="xs" minW={0}>
      <Text color="text.muted" flexShrink={0} sx={TABULAR}>
        {timeOfDay(entry.time)}
      </Text>
      <ActorBadge actor={entry.actor} />
      <Text flex={1} minW={0} noOfLines={1} title={describeOp(entry)}>
        {describeOp(entry)}
      </Text>
      <OutcomeText entry={entry} />
    </Flex>
    {entry.ok === false && entry.message && (
      <Text fontSize="0.65rem" color="status.error" pl="72px">
        {entry.message}
      </Text>
    )}
  </Box>
);

/**
 * Every chamber.pld op the chamber node handled, newest first: who asked
 * (a Deck user, or the agent through the MCP server), what, and the answer.
 * pld-gui and other direct pld-service clients do not pass through the node,
 * so they show only in Recent events.
 */
export const ActivityList = () => {
  const activity = useChamberPldStore((s) => s.activity);
  if (!activity.length) {
    return (
      <Text fontSize="xs" color="text.muted">
        No operations yet
      </Text>
    );
  }
  return (
    <VStack align="stretch" spacing={0} maxH="220px" overflowY="auto">
      {activity.map((e) => (
        <ActivityRow key={e.seq} entry={e} />
      ))}
    </VStack>
  );
};

/** The newest RHEED gun op, whoever sent it, for the line under the gun's buttons. */
export const LastGunAction = () => {
  const last = useChamberPldStore((s) => s.activity.find((e) => RHEED_GUN_OPS.has(e.op ?? "")));
  if (!last) return null;
  return (
    <Box fontSize="0.65rem" color="text.muted">
      <Flex align="center" gap={1.5}>
        <Text whiteSpace="nowrap">Last action</Text>
        <ActorBadge actor={last.actor} />
      </Flex>
      <Text sx={TABULAR}>
        <Text as="span" color="text.primary">
          {describeOp(last)}
        </Text>{" "}
        · {timeOfDay(last.time)} ·{" "}
        <Text as="span" color={last.ok === false ? "status.error" : undefined}>
          {outcome(last)}
        </Text>
      </Text>
    </Box>
  );
};
