import { useEffect, useMemo } from "react";

import { BBox, LumiTransport, RheedIntegratorClient } from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useIntegratorNodeStore from "../stores/nodes/integrator";
import useSTFTNodeStore from "../stores/nodes/stft";
import useLiveAnalysisStore from "../stores/liveAnalysis";
import useRegisteredBoxesStore from "../stores/registeredBoxes";

/**
 * A box as the *backend* has it: registered on the node, shared by every client,
 * and alive until someone removes it or the node restarts.
 */
export interface RegisteredBox {
  /** `String(bbox_id)` -- the frontend's detection id is the backend's bbox id. */
  id: string;
  bboxId: number;
  /** Backend form: origin + extent, in camera-frame pixels. */
  bbox: BBox;
  /** Corner form `[x1, y1, x2, y2]`, which is what the overlay rectangles want. */
  corners: number[];
  /** The integrator is producing an intensity series for this box. */
  isIntegrating: boolean;
  /** The STFT calculator is running over that series. */
  isRunningSTFT: boolean;
}

const toCorners = (bbox: BBox): number[] => [
  bbox.x,
  bbox.y,
  bbox.x + bbox.width,
  bbox.y + bbox.height,
];

/** Refetch the geometry now, rather than waiting for the next heartbeat to notice. */
export const refreshRegisteredBoxes = async (transport: LumiTransport) => {
  const store = useRegisteredBoxesStore.getState();
  try {
    const list = await new RheedIntegratorClient(transport).bboxes();
    store.setGeometry(list.bboxes ?? {});
  } catch (err) {
    store.setError(err instanceof Error ? err.message : String(err));
  }
};

/**
 * Keeps the backend's box registry mirrored into the frontend, live.
 *
 * Mounted exactly once, by `LumiTransportProvider`. Boxes are node state, not
 * page state -- so a box registered in another browser, or one registered before
 * this page was last reloaded, has to show up here. Previously it could not:
 * boxes existed only in `useLiveAnalysisStore`, which starts empty on every
 * load, so a reload appeared to lose boxes that were in fact still registered
 * and still being integrated on the node.
 *
 * There is no bbox-change event to subscribe to, but there does not need to be.
 * `registered_bboxes` is part of each capability's state, capability state rides
 * the node's 2s heartbeat, and the registry pushes a `state_changed` event
 * whenever a heartbeat's capability blob differs from the last -- which a
 * register or remove by *anyone* makes true. So the id list is already arriving
 * live through `useSystemRegistryStream`; measured end to end, another client's
 * register is visible here in about 1.8s. All this hook adds is one `bboxes()`
 * call to pick up coordinates, made only when the id set actually moves.
 *
 * The effect is keyed on the ids joined into a string, not on the array: the
 * heartbeat rebuilds that array every 2s, so an array dep would refetch forever.
 */
export const useRegisteredBoxesSync = () => {
  const transport = useTransportStore((s) => s.transport);
  // Selecting the joined string rather than the array is load-bearing for the
  // same reason -- zustand compares with Object.is, and a fresh array every
  // heartbeat would re-render every consumer twice a second.
  const integratorKey = useIntegratorNodeStore((s) =>
    s.state.registered_bboxes.join(",")
  );

  useEffect(() => {
    if (!transport) {
      useRegisteredBoxesStore.getState().reset();
      return;
    }

    let cancelled = false;
    const store = useRegisteredBoxesStore.getState();
    if (store.lastSyncedAt === null) store.setLoading(true);

    // Runs on connect as well as on every id change: on a fresh connection the
    // heartbeat has not landed yet, and `bboxes()` is authoritative, so waiting
    // for it would leave the panel blank for up to two seconds.
    new RheedIntegratorClient(transport)
      .bboxes()
      .then((list) => {
        if (cancelled) return;
        useRegisteredBoxesStore.getState().setGeometry(list.bboxes ?? {});
      })
      .catch((err) => {
        if (cancelled) return;
        useRegisteredBoxesStore
          .getState()
          .setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [transport, integratorKey]);
};

/**
 * The backend's registered boxes, joined from the live id list and the fetched
 * geometry.
 *
 * The join runs over the *ids*, not the geometry: the ids are the fresher of the
 * two (pushed, vs. fetched in response), so a box another client removed stops
 * being listed on the next heartbeat even though its coordinates are still in
 * the geometry cache. A box whose geometry has not arrived yet is left out
 * rather than drawn at a made-up position -- that window is one round trip,
 * since the id change is itself what triggers the fetch.
 */
export const useRegisteredBoxes = () => {
  // Joined strings, not the arrays. The heartbeat rebuilds `registered_bboxes`
  // every 2s, so selecting the array would hand every consumer a new reference
  // twice a second -- re-rendering the sidebar, rebuilding `boxes`, and firing
  // reconciliation, all to arrive at exactly the same answer. A string compares
  // by value under `Object.is`, so nothing downstream moves unless the set does.
  const integratorKey = useIntegratorNodeStore((s) =>
    s.state.registered_bboxes.join(",")
  );
  const stftKey = useSTFTNodeStore((s) => s.state.registered_bboxes.join(","));
  const geometry = useRegisteredBoxesStore((s) => s.geometry);
  const isLoading = useRegisteredBoxesStore((s) => s.isLoading);
  const error = useRegisteredBoxesStore((s) => s.error);
  const lastSyncedAt = useRegisteredBoxesStore((s) => s.lastSyncedAt);

  return useMemo(() => {
    const parse = (key: string) =>
      key === "" ? [] : key.split(",").map(Number);
    const integratorIds = parse(integratorKey);
    const stft = new Set(parse(stftKey));

    const boxes: RegisteredBox[] = [];
    for (const bboxId of integratorIds) {
      const bbox = geometry[String(bboxId)];
      if (!bbox) continue;
      boxes.push({
        id: String(bboxId),
        bboxId,
        bbox,
        corners: toCorners(bbox),
        isIntegrating: true,
        isRunningSTFT: stft.has(bboxId),
      });
    }
    boxes.sort((a, b) => a.bboxId - b.bboxId);

    return {
      boxes,
      isLoading,
      error,
      lastSyncedAt,
      /** Ids the node reports but whose coordinates have not landed yet. */
      isSyncing: boxes.length !== integratorIds.length,
    };
  }, [integratorKey, stftKey, geometry, isLoading, error, lastSyncedAt]);
};

/**
 * Folds the backend's registry into `useLiveAnalysisStore`, so registered boxes
 * are drawn on the video and listed in the analyzer whoever created them.
 *
 * Mounted once alongside the sync hook. Kept separate from it because the two
 * answer different questions: the sync hook owns *what the node has*, this owns
 * *what this UI shows*, and only the second is allowed to carry local state a
 * box may have (its name, and geometry the user drew at sub-pixel precision that
 * the backend rounded).
 */
export const useBackendBoxReconciliation = () => {
  const { boxes } = useRegisteredBoxes();
  const reconcile = useLiveAnalysisStore((s) => s.reconcileWithBackend);

  useEffect(() => {
    reconcile(boxes);
  }, [boxes, reconcile]);
};

export default useRegisteredBoxes;
