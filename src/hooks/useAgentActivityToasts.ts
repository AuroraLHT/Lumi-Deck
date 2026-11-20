import { useEffect } from "react";
import { useToast } from "@chakra-ui/react";

import useChamberPldStore from "../stores/chamberPld";
import { actorLabel, describeOp, isAgent } from "../components/ChamberPld/activity";

/** Ops older than this when first seen are history (a reconnect, a seed), not news. */
const FRESH_S = 30;

/**
 * A toast whenever the agent acts on the chamber: when its op starts, and
 * again if it is refused or once a long one (a ramp, a waited move) ends --
 * so whoever is at the Deck sees the agent at work without watching the
 * Activity list. Entries in the seed, or pushed before it came back, are
 * remembered but not announced. Mounted once, by `LumiTransportProvider`.
 */
const useAgentActivityToasts = () => {
  const toast = useToast();

  useEffect(() => {
    // seq -> whether it was still running when last seen.
    const seen = new Map<number, boolean>();
    const check = ({ activity, activityLoaded }: ReturnType<typeof useChamberPldStore.getState>) => {
      const now = Date.now() / 1000;
      for (const e of activity) {
        if (e.seq == null) continue;
        const before = seen.get(e.seq);
        seen.set(e.seq, Boolean(e.running));
        if (!activityLoaded || !isAgent(e.actor)) continue;
        const who = actorLabel(e.actor);
        if (before === undefined) {
          if (now - (e.time ?? 0) > FRESH_S) continue;
          toast({
            title: `${who}: ${describeOp(e)}`,
            description: e.running ? "Running…" : e.ok === false ? `Refused: ${e.message}` : e.message || undefined,
            status: e.ok === false ? "warning" : "info",
            duration: 6000,
            isClosable: true,
            position: "bottom-right",
          });
        } else if (before && !e.running) {
          toast({
            title: `${who}: ${describeOp(e)} ${e.ok === false ? "refused" : "done"}`,
            description: e.message || undefined,
            status: e.ok === false ? "warning" : "success",
            duration: 6000,
            isClosable: true,
            position: "bottom-right",
          });
        }
      }
    };

    check(useChamberPldStore.getState());
    return useChamberPldStore.subscribe((s, prev) => {
      if (s.activity !== prev.activity) check(s);
    });
  }, [toast]);
};

export default useAgentActivityToasts;
