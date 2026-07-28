import { useMemo } from "react";

import { NodeRecord } from "../generated/lumi";
import useTransportStore, { TransportStatus } from "../clients/transport";
import useSystemRegistryStore from "../stores/systemRegistry";

const sortNodes = (nodes: NodeRecord[]): NodeRecord[] =>
  [...nodes].sort((a, b) =>
    a.equipment === b.equipment
      ? a.instance_id.localeCompare(b.instance_id)
      : a.equipment.localeCompare(b.equipment)
  );

export interface SystemRegistry {
  nodes: NodeRecord[];
  isLoading: boolean;
  error: Error | null;
  status: TransportStatus;
}

/**
 * Live node presence from the refactored backend's SystemRegistry.
 *
 * A read-only view of the registry store. The subscription that fills it is
 * owned by `useSystemRegistryStream`, mounted once in `LumiTransportProvider`:
 * this hook has several consumers, and one subscription per consumer meant they
 * overwrote each other's stream handler and cancelled each other's feed on
 * unmount. Safe to call from as many components as needed.
 */
const useSystemRegistry = (): SystemRegistry => {
  const status = useTransportStore((s) => s.status);
  const nodes = useSystemRegistryStore((s) => s.nodes);
  const isLoading = useSystemRegistryStore((s) => s.isLoading);
  const error = useSystemRegistryStore((s) => s.error);

  // Sorting allocates, and `nodes` is a stable reference between registry
  // updates, so keep the array identity stable for consumers' effect deps.
  const sorted = useMemo(() => sortNodes(Object.values(nodes)), [nodes]);

  return { nodes: sorted, isLoading, error, status };
};

export default useSystemRegistry;
