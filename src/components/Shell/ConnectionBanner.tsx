import { Alert, AlertIcon, Link, Text, VStack } from "@chakra-ui/react";

import useTransportStore from "../../clients/transport";
import { hostAddress, httpOrigin, isSecureHost, tailscaleHostHint } from "../../stores/app";

/** The fourth failure comes about 7 s in (1 + 2 + 4 s of backoff): past a brief network blip. */
const SHOW_AFTER_FAILURES = 4;

/**
 * Shown over every page when the bridge socket keeps failing. The login page
 * has the same hint, but a still-valid session skips the login page entirely:
 * after a server restart, or once Chrome forgets a certificate exception, the
 * dashboard would otherwise just say "retrying" forever. A refused certificate
 * and a server that is down look identical to the browser (a bare 1006), so
 * the text names both.
 */
const ConnectionBanner = () => {
  const status = useTransportStore((s) => s.status);
  const failures = useTransportStore((s) => s.failures);
  const host = useTransportStore((s) => s.host);

  if (status === "open" || failures < SHOW_AFTER_FAILURES || !host) return null;

  const healthUrl = `${httpOrigin(host)}/health`;

  return (
    <Alert status="warning" borderRadius="md" fontSize="sm" mb={3} alignItems="flex-start">
      <AlertIcon />
      {isSecureHost(host) ? (
        <VStack align="stretch" spacing={1}>
          <Text fontSize="sm">
            Can't reach {hostAddress(host)}; still retrying. If the server is running, this browser
            probably no longer trusts its certificate: open its health check, accept the warning,
            then come back. Or switch to {tailscaleHostHint()}, which needs no click-through.
          </Text>
          <Link href={healthUrl} isExternal fontWeight="600" color="inherit" textDecoration="underline">
            Open {healthUrl}
          </Link>
        </VStack>
      ) : (
        <Text fontSize="sm">
          Can't reach {host}; still retrying. Check that the server is running and allows this
          origin.
        </Text>
      )}
    </Alert>
  );
};

export default ConnectionBanner;
