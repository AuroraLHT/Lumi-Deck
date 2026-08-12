import { useEffect } from "react";

import {
  CameraState,
  IntegratorState,
  MIModeState,
  NodeRecord,
  STFTState,
  StorageState,
} from "../generated/lumi";
import useSystemRegistry from "./useSystemRegistry";
import useRHEEDNodeStore from "../stores/nodes/rheed";
import useRHEEDCameraNodeStore from "../stores/nodes/rheedCamera";
import useChamberLogNodeStore from "../stores/nodes/chamberLog";
import useDetectorNodeStore from "../stores/nodes/detector";
import useSTFTNodeStore from "../stores/nodes/stft";
import useIntegratorNodeStore from "../stores/nodes/integrator";
import useStorageNodeStore from "../stores/nodes/storage";
import useMIModeNodeStore from "../stores/nodes/miMode";

/**
 * Feeds the per-node state stores from the SystemRegistry, replacing the old SSE
 * feed on `/nodes/state` (that endpoint no longer exists -- the bridge speaks one
 * protocol on `/ws`). The registry already carries each capability's `state`
 * blob, so this is a projection of `useSystemRegistry`, not a second connection.
 *
 * These stores gate whether the detection overlay draws at all and supply the
 * frame dimensions the overlay and the box selector scale against, so without
 * this they sit at their defaults (`is_running: false`) and the overlay stays
 * empty no matter what the detection capability sends.
 *
 * Note `frame_dims` comes from the rheed node's *camera* capability, not `video`:
 * the video capability describes the encoded fragments, the camera capability
 * describes the sensor the boxes are expressed in.
 */
const capabilityState = (node: NodeRecord | undefined, name: string) =>
  node?.capabilities?.find((capability) => capability.name === name)?.state as
    | Record<string, unknown>
    | undefined;

const useNodeStates = () => {
  const { nodes } = useSystemRegistry();

  const setRHEEDNodeState = useRHEEDNodeStore((s) => s.setState);
  const setRHEEDCameraNodeState = useRHEEDCameraNodeStore((s) => s.setState);
  const setChamberLogNodeState = useChamberLogNodeStore((s) => s.setState);
  const setDetectorNodeState = useDetectorNodeStore((s) => s.setState);
  const setSTFTNodeState = useSTFTNodeStore((s) => s.setState);
  const setIntegratorNodeState = useIntegratorNodeStore((s) => s.setState);
  const setStorageNodeState = useStorageNodeStore((s) => s.setState);
  const setMIModeNodeState = useMIModeNodeStore((s) => s.setState);

  useEffect(() => {
    const byEquipment = new Map<string, NodeRecord>();
    for (const node of nodes) {
      // A node that has aged out but is still listed must not report itself
      // available; prefer an "up" instance if several are present.
      const existing = byEquipment.get(node.equipment);
      if (!existing || (existing.status !== "up" && node.status === "up")) {
        byEquipment.set(node.equipment, node);
      }
    }

    const rheed = byEquipment.get("rheed");
    const chamber = byEquipment.get("chamber");
    const detection = byEquipment.get("detection");
    const storage = byEquipment.get("storage");

    const common = (node: NodeRecord | undefined, capability: string) => {
      const state = capabilityState(node, capability);
      return {
        is_available: node?.status === "up",
        is_running: Boolean(state?.is_running),
        is_streaming: Boolean(state?.is_streaming),
      };
    };

    const rheedCamera = capabilityState(rheed, "camera") as CameraState | undefined;
    setRHEEDNodeState({
      ...common(rheed, "video"),
      // Keep the store's defaults if the node has not reported dimensions yet --
      // a zero-sized frame would collapse every overlay rectangle.
      ...(rheedCamera?.frame_dims ? { frame_dims: rheedCamera.frame_dims } : {}),
    });

    setRHEEDCameraNodeState(common(rheed, "camera"));

    // The registered box ids ride the heartbeat, so this projection is also the
    // live feed of *who else* has registered a box -- see `useRegisteredBoxes`.
    // Defaulting to [] when the node is absent is deliberate: with no node there
    // is no registry, and claiming the last-known boxes are still registered
    // would be a lie the UI cannot recover from.
    const integrator = capabilityState(rheed, "integrator") as IntegratorState | undefined;
    setIntegratorNodeState({
      ...common(rheed, "integrator"),
      registered_bboxes: integrator?.registered_bboxes ?? [],
    });

    const stft = capabilityState(rheed, "stft") as STFTState | undefined;
    setSTFTNodeState({
      ...common(rheed, "stft"),
      registered_bboxes: stft?.registered_bboxes ?? [],
    });

    setChamberLogNodeState(common(chamber, "log"));
    setDetectorNodeState(common(detection, "detection"));

    // MI mode is what the chamber is *doing*: which script it is executing and
    // how many are still queued behind it. Written out field by field rather
    // than spread from `common` because mi_mode is PUBSUB -- its update loop is
    // never gated by start/stop, so `is_streaming` is permanently false and has
    // no place on this store.
    const miMode = capabilityState(chamber, "mi_mode") as MIModeState | undefined;
    setMIModeNodeState({
      is_available: chamber?.status === "up",
      is_running: Boolean(miMode?.is_running),
      num_executions: miMode?.num_executions ?? 0,
      current_execution: miMode?.current_execution ?? null,
    });

    // Recording is shared state: one operator's session is every operator's
    // session, and the file it writes is the experiment. Projecting it here is
    // what lets the Storage panel show the node's truth instead of a local flag
    // that only ever reflects clicks made in *this* tab.
    const storageState = capabilityState(storage, "storage") as StorageState | undefined;
    setStorageNodeState({
      ...common(storage, "storage"),
      is_storing: Boolean(storageState?.is_storing),
      // Null rather than the last known name when the node is gone: a stale
      // project name over a stopped recorder reads as "still recording".
      project_name: storageState?.project_name ?? null,
      path: storageState?.path ?? null,
      deps_available: storageState?.deps_available ?? {},
    });
  }, [
    nodes,
    setRHEEDNodeState,
    setRHEEDCameraNodeState,
    setChamberLogNodeState,
    setDetectorNodeState,
    setSTFTNodeState,
    setIntegratorNodeState,
    setStorageNodeState,
    setMIModeNodeState,
  ]);
};

export default useNodeStates;
