import { useCallback } from "react";
import { QueryClient, keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ChamberLogClient,
  ExperimentDriverClient,
  ListSamples,
  LogWindowQuery,
  LumiTransport,
  MeasurementFileInfo,
  RecordingInfo,
  RecordingIntegrationQuery,
  RecordingJpegQuery,
  StorageArchiveClient,
} from "../generated/lumi";
import useTransportStore from "../clients/transport";
import useExperimentDriverNodeStore from "../stores/nodes/experimentDriver";
import useStorageNodeStore from "../stores/nodes/storage";
import useChamberLogNodeStore from "../stores/nodes/chamberLog";

/**
 * Read-only queries behind the History page: growth.db through the experiment
 * driver, finished recordings through `storage.archive`, past chamber logs
 * through `chamber.log`. All of them are allowed for a viewer.
 *
 * Each is gated on its node being up, for the same reason the streams are: a
 * request at an absent node holds the call for the whole server-side timeout.
 * Keys carry the host, so another chamber's history is never shown from cache.
 *
 * Nothing here is polled. What a past growth left is fixed; the lists (samples,
 * steps) can grow, and are refetched when the page regains focus.
 */

type Node = "experiment" | "storage" | "chamber";

const useNodeUp = (node: Node) => {
  const experiment = useExperimentDriverNodeStore((s) => s.state.is_available);
  const storage = useStorageNodeStore((s) => s.state.is_available);
  const chamber = useChamberLogNodeStore((s) => s.state.is_available);
  return { experiment, storage, chamber }[node];
};

/** Settled for good: a finished recording, or a log window in the past. */
const FOREVER = Infinity;
const LISTS = 30_000;
/**
 * A recording still being written (v2 files can be read while they grow) is
 * re-read this often, so the viewer follows it; a finished one never is.
 */
const LIVE_MS = 5000;
/** Frames and files nobody is looking at are kept this long, then their blobs freed. */
const BLOB_GC_MS = 2 * 60_000;

const useHistoryQuery = <T>(
  node: Node,
  key: unknown[],
  fn: (transport: LumiTransport) => Promise<T>,
  {
    enabled = true,
    staleTime = LISTS,
    gcTime,
    keepPrevious = false,
    refetchInterval,
  }: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    keepPrevious?: boolean;
    refetchInterval?: number | false | ((query: { state: { data: T | undefined } }) => number | false);
  } = {}
) => {
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  const up = useNodeUp(node);

  const query = useQuery({
    queryKey: ["history", host, ...key],
    queryFn: () => fn(transport!),
    enabled: Boolean(transport) && up && enabled,
    staleTime,
    ...(gcTime !== undefined ? { gcTime } : {}),
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
    ...(refetchInterval !== undefined ? { refetchInterval } : {}),
    retry: 1,
  });
  return { ...query, nodeUp: up };
};

const driver = (t: LumiTransport) => new ExperimentDriverClient(t);
const archive = (t: LumiTransport) => new StorageArchiveClient(t);

/** Enough for every sample on a working instrument; the page says when there are more. */
const SAMPLE_PAGE = 500;
/** A sample's journal: one growth is ~20 steps, so this is dozens of layers. */
const STEP_PAGE = 1000;

export const useSubstrates = () =>
  useHistoryQuery("experiment", ["substrates"], (t) =>
    driver(t).list_substrates({ limit: 1000, include_retired: true })
  );

export const useSamples = (filter: Pick<ListSamples, "substrate_id" | "state" | "search">) =>
  useHistoryQuery("experiment", ["samples", filter], (t) =>
    driver(t).list_samples({ limit: SAMPLE_PAGE, ...filter })
  );

export const useSampleDetail = (sampleId: number | null) =>
  useHistoryQuery(
    "experiment",
    ["sample", sampleId],
    (t) => driver(t).get_sample({ sample_id: sampleId! }),
    { enabled: sampleId !== null }
  );

/** The sample's step journal, oldest first -- the order it happened in. */
export const useSampleSteps = (sampleId: number | null) =>
  useHistoryQuery(
    "experiment",
    ["steps", sampleId],
    (t) => driver(t).sample_history({ sample_id: sampleId!, limit: STEP_PAGE, order: "asc" }),
    { enabled: sampleId !== null }
  );

/** The growth.db experiments on a substrate: the recipes, with the conditions each was run at. */
export const useSubstrateExperiments = (substrateId: number | null) =>
  useHistoryQuery(
    "experiment",
    ["experiments", substrateId],
    (t) => driver(t).list_experiments({ substrate_id: substrateId!, limit: 200, order: "asc" }),
    { enabled: substrateId !== null }
  );

export const useSampleMeasurements = (sampleId: number | null) =>
  useHistoryQuery(
    "experiment",
    ["measurements", sampleId],
    (t) => driver(t).list_measurements({ sample_id: sampleId!, limit: 200 }),
    { enabled: sampleId !== null }
  );

/** One measurement with its curves; `list_measurements` leaves them out. */
export const useMeasurement = (measurementId: number | null) =>
  useHistoryQuery(
    "experiment",
    ["measurement", measurementId],
    (t) => driver(t).get_measurement({ measurement_id: measurementId! }),
    { enabled: measurementId !== null }
  );

export interface FetchedFile {
  url: string;
  info: MeasurementFileInfo;
}

/**
 * An attached file's bytes as an object URL, typed with its `media_type` --
 * for an image to show inline or anything else to download under its name.
 * Freed on eviction like a frame (`revokeEvictedBlobs`).
 */
const fetchFile = async (t: LumiTransport, fileId: number): Promise<FetchedFile> => {
  const { meta, payload } = await driver(t).measurement_file({ file_id: fileId });
  const url = URL.createObjectURL(new Blob([payload as BlobPart], { type: meta.media_type }));
  return { url, info: meta };
};

export const useMeasurementFile = (fileId: number | null) =>
  useHistoryQuery("experiment", ["file", fileId], (t) => fetchFile(t, fileId!), {
    enabled: fileId !== null,
    staleTime: FOREVER,
    gcTime: BLOB_GC_MS,
  });

/**
 * Fetch a file on demand (a download button), through the same cache entry an
 * inline view would use, so a file fetched once is not fetched again.
 */
export const useFileFetcher = () => {
  const client = useQueryClient();
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);
  return useCallback(
    (fileId: number) => {
      if (!transport) return Promise.reject(new Error("not connected"));
      return client.fetchQuery({
        queryKey: ["history", host, "file", fileId],
        queryFn: () => fetchFile(transport, fileId),
        staleTime: FOREVER,
        gcTime: BLOB_GC_MS,
      });
    },
    [client, transport, host]
  );
};

/** Every file in the archive, newest first -- recordings no sample journal names included. */
export const useRecordings = (search: string) =>
  useHistoryQuery(
    "storage",
    ["recordings", search],
    (t) => archive(t).list_recordings({ search: search || null, limit: 1000 }),
    { refetchInterval: (q) => (q.state.data?.recordings?.some((r) => r.recording) ? LIVE_MS : false) }
  );

/** Re-read while the file is still being written; settled for good after. */
const followLive = (live: boolean) =>
  live ? { staleTime: 0, refetchInterval: LIVE_MS } : { staleTime: FOREVER };

export const useRecordingInfo = (name: string | null) =>
  useHistoryQuery(
    "storage",
    ["recording", name],
    (t) => archive(t).recording_info({ name: name! }),
    {
      enabled: name !== null,
      staleTime: FOREVER,
      // Polls only while the file says it is recording, then never again.
      refetchInterval: (q: { state: { data: RecordingInfo | undefined } }) =>
        q.state.data?.recording ? LIVE_MS : false,
    }
  );

export const useRecordingIntegration = (
  name: string | null,
  query?: Partial<RecordingIntegrationQuery>,
  live = false
) =>
  useHistoryQuery(
    "storage",
    ["integration", name, query],
    (t) => archive(t).recording_integration({ name: name!, ...query }),
    { enabled: name !== null, ...followLive(live) }
  );

/** Tasks, chamber events, camera and box changes, notes. Empty for a v1 file. */
export const useRecordingEvents = (name: string | null, live = false) =>
  useHistoryQuery(
    "storage",
    ["events", name],
    (t) => archive(t).recording_events({ name: name!, limit: 5000 }),
    { enabled: name !== null, ...followLive(live) }
  );

/** Box counts and class scores per detection, thinned for a chart. */
export const useRecordingDetections = (name: string | null, live = false) =>
  useHistoryQuery(
    "storage",
    ["detections", name],
    (t) => archive(t).recording_detections({ name: name!, max_points: 2000 }),
    { enabled: name !== null, ...followLive(live) }
  );

/** One detection's boxes and crop, to draw on the frame it belongs to. */
export const useRecordingDetection = (name: string | null, index: number | null) =>
  useHistoryQuery(
    "storage",
    ["detection", name, index],
    (t) => archive(t).recording_detection({ name: name!, index: index! }),
    { enabled: name !== null && index !== null, staleTime: FOREVER, keepPrevious: true }
  );

export interface RecordedFrame {
  url: string;
  time: number | null;
  width: number;
  height: number;
  low: number;
  high: number;
}

/**
 * One recorded frame as an object URL. Revoked when react-query drops it from
 * the cache (see `revokeEvictedFrames`), not on unmount, so scrubbing back over
 * a frame is instant rather than a re-fetch.
 */
export const useRecordingFrame = (name: string | null, index: number, opts?: Partial<RecordingJpegQuery>) =>
  useHistoryQuery(
    "storage",
    ["frame", name, index, opts],
    async (t): Promise<RecordedFrame> => {
      const { meta, payload } = await archive(t).recording_frame_jpeg({ name: name!, index, ...opts });
      const url = URL.createObjectURL(new Blob([payload as BlobPart], { type: "image/jpeg" }));
      return { url, time: meta.time ?? null, width: meta.width, height: meta.height, low: meta.low, high: meta.high };
    },
    // Keep showing the last frame while the next loads: a scrubber that blanks
    // between frames flickers.
    { enabled: name !== null, staleTime: FOREVER, gcTime: BLOB_GC_MS, keepPrevious: true }
  );

/**
 * Frees an object URL -- a recorded frame, a file, a simulated pattern -- once
 * react-query evicts the query holding it. Installed once on the app's client:
 * eviction happens `gcTime` after the last viewer unmounts, when no component
 * is left to do it. Any query whose data carries a `blob:` `url` is covered.
 */
export const revokeEvictedBlobs = (client: QueryClient) =>
  client.getQueryCache().subscribe((event) => {
    if (event.type !== "removed") return;
    const url = (event.query.state.data as { url?: unknown } | undefined)?.url;
    if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
  });

export const useLogWindow = (query: LogWindowQuery | null) =>
  useHistoryQuery(
    "chamber",
    ["log", query],
    (t) => new ChamberLogClient(t).log_window(query!),
    // A window that ends in the past cannot change; one reaching now can.
    {
      enabled: query !== null,
      staleTime: query?.until != null && query.until * 1000 < Date.now() ? FOREVER : LISTS,
    }
  );
