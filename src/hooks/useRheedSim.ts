import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  LumiTransport,
  RheedJpegMeta,
  RheedJpegRequest,
  RheedSimRequest,
  SaveStructure,
  SimulationRheedSimClient,
} from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useSimulationNodeStore from "../stores/nodes/simulation";

/**
 * Queries against the simulation node (`simulation.rheed_sim`). The reads --
 * structures, spots, patterns -- are open to a viewer; saving and deleting a
 * structure is an operator's.
 *
 * A result depends only on its request, so each is cached by the request and
 * never goes stale; what changes is the request, as the scene is edited. The
 * previous result stays up while the next is computed, so a slider does not
 * blank the pattern at every step.
 */

const sim = (t: LumiTransport) => new SimulationRheedSimClient(t);

/** How long the scene has to sit still before it is sent: one request per pause, not per keystroke. */
const SETTLE_MS = 250;
/** Patterns nobody is looking at are dropped (and their blobs freed) after this. */
const PATTERN_GC_MS = 60_000;

export const useDebounced = <T,>(value: T, ms = SETTLE_MS) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
};

const useSimQuery = <T,>(
  key: unknown[],
  fn: (transport: LumiTransport) => Promise<T>,
  { enabled = true, gcTime, keepPrevious = false }: { enabled?: boolean; gcTime?: number; keepPrevious?: boolean } = {}
) => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const up = useSimulationNodeStore((s) => s.state.is_available);

  const query = useQuery({
    queryKey: ["rheedsim", host, ...key],
    queryFn: () => fn(transport!),
    enabled: Boolean(transport) && up && enabled,
    staleTime: Infinity,
    ...(gcTime !== undefined ? { gcTime } : {}),
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
    // A bad scene (an azimuth off the surface plane, a termination the cut does
    // not have) fails the same way every time: say so at once.
    retry: false,
  });
  return { ...query, nodeUp: up };
};

/** Built-in structures, then saved ones. Refetched after a save or delete. */
export const useStructures = () =>
  useSimQuery(["structures"], (t) => sim(t).list_structures());

export const useStructure = (name: string | null) =>
  useSimQuery(["structure", name], (t) => sim(t).get_structure({ name: name! }), {
    enabled: name !== null,
  });

/** Where every spot lands, without the image: tens of milliseconds, fine for an overlay. */
export const useSimSpots = (request: RheedSimRequest | null) =>
  useSimQuery(["spots", request], (t) => sim(t).rheed_spots(request!), {
    enabled: request !== null,
    keepPrevious: true,
  });

export interface SimPattern {
  url: string;
  meta: RheedJpegMeta;
}

/** The rendered pattern as a JPEG object URL, with its spot list. */
export const useSimPattern = (request: RheedJpegRequest | null) =>
  useSimQuery(
    ["pattern", request],
    async (t): Promise<SimPattern> => {
      const { meta, payload } = await sim(t).simulate_rheed_jpeg(request!);
      const url = URL.createObjectURL(new Blob([payload as BlobPart], { type: "image/jpeg" }));
      return { url, meta };
    },
    { enabled: request !== null, gcTime: PATTERN_GC_MS, keepPrevious: true }
  );

/** Save and delete a structure -- MUTATE, an operator or admin only. */
export const useStructureWrites = () => {
  const client = useQueryClient();
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);

  return useMemo(() => {
    const node = () => {
      if (!transport) throw new Error("not connected");
      return sim(transport);
    };
    // A saved structure can be overwritten under the same name, so every cached
    // result that named it may be stale -- drop them all, not just the list.
    const refresh = () => client.invalidateQueries({ queryKey: ["rheedsim", host] });

    return {
      save: async (req: SaveStructure) => {
        const info = await node().save_structure(req);
        await refresh();
        return info;
      },
      remove: async (name: string) => {
        await node().delete_structure({ name });
        await refresh();
      },
    };
  }, [client, transport, host]);
};
