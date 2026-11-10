import { Text } from "@chakra-ui/react";

import useChamberPldStaleness from "../../../hooks/useChamberPldStaleness";

/** A one-line warning under a chart's toolbar when the chamber.pld stream it plots from looks unhealthy. */
const PldStreamBanner = () => {
  const { stale, connected, readOnly } = useChamberPldStaleness();
  if (connected && !stale && !readOnly) return null;

  const message = !connected
    ? "pld-service is not answering -- stale"
    : stale
    ? "No update in 5s -- stale"
    : "pld-service is read-only";

  return (
    <Text fontSize="0.65rem" color="status.warn" px={2} py="2px" flexShrink={0}>
      {message}
    </Text>
  );
};

export default PldStreamBanner;
