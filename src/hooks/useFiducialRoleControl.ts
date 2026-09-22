import { useCallback } from "react";

import { ChamberFiducialClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useFiducialRolesStore from "../stores/fiducialRoles";

/**
 * Assigns and clears `chamber.fiducial` role names.
 *
 * Write-through, like `useFiducialMarkerControl`: the call goes out first and
 * the local mirror is updated only once the node has acked it, so a rejected
 * write (these ops are operator-only) leaves the UI showing what the node
 * actually holds. There is no heartbeat to fall back on for roles -- see
 * `useFiducialRoles` -- so this update is not merely an optimistic shortcut,
 * it is how this client learns its own edit landed.
 *
 * `setRole` on a role that already exists re-points it; that is the node's
 * behaviour and the UI does not pretend otherwise.
 */
const useFiducialRoleControl = () => {
  const transport = useTransportStore((s) => s.transport);

  const setRole = useCallback(
    async (role: string, markerId: string) => {
      if (!transport) return;
      await new ChamberFiducialClient(transport).set_role({ role, marker_id: markerId });
      useFiducialRolesStore.setState((s) => ({ roles: { ...s.roles, [role]: markerId } }));
    },
    [transport]
  );

  const removeRole = useCallback(
    async (role: string) => {
      if (!transport) return;
      await new ChamberFiducialClient(transport).remove_role({ role });
      useFiducialRolesStore.setState((s) => {
        const roles = { ...s.roles };
        delete roles[role];
        return { roles };
      });
    },
    [transport]
  );

  return { setRole, removeRole };
};

export default useFiducialRoleControl;
