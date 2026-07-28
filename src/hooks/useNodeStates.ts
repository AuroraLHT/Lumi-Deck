import { useEffect } from "react";

import { CameraState, NodeRecord } from "../generated/lumi";
import useSystemRegistry from "./useSystemRegistry";
import useRHEEDNodeStore from "../stores/nodes/rheed";
import useRHEEDCameraNodeStore from "../stores/nodes/rheedCamera";
import useChamberLogNodeStore from "../stores/nodes/chamberLog";
import useDetectorNodeStore from "../stores/nodes/detector";
import useSTFTNodeStore from "../stores/nodes/stft";
import useIntegratorNodeStore from "../stores/nodes/integrator";

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
    setIntegratorNodeState(common(rheed, "integrator"));
    setSTFTNodeState(common(rheed, "stft"));
    setChamberLogNodeState(common(chamber, "log"));
    setDetectorNodeState(common(detection, "detection"));
  }, [
    nodes,
    setRHEEDNodeState,
    setRHEEDCameraNodeState,
    setChamberLogNodeState,
    setDetectorNodeState,
    setSTFTNodeState,
    setIntegratorNodeState,
  ]);
};

export default useNodeStates;
