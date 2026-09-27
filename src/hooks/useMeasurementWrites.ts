import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  AddMeasurement,
  AttachMeasurementFile,
  ExperimentDriverClient,
  MeasurementFileInfo,
} from "../generated/lumi";
import useTransportStore from "../clients/transport";

/** Hex SHA-256, or null where the browser offers no WebCrypto (plain http off localhost). */
const sha256 = async (bytes: Uint8Array) => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * How long an upload may take before it counts as lost: the transport's usual
 * 10 s, plus 2 s per MB -- a 15 MB file over a slow link (~0.5 MB/s) still
 * lands, and a small one still fails fast.
 */
const uploadTimeoutMs = (bytes: number) => 10_000 + Math.ceil(bytes / 1e6) * 2_000;

export interface AttachedFile {
  info: MeasurementFileInfo;
  /** The server's sha256 matches what was sent; null when it could not be checked here. */
  verified: boolean | null;
}

/**
 * The measurement writes the History page makes: add one, attach files,
 * retire a file or a whole measurement. All MUTATE -- an operator or admin
 * only; a viewer gets Forbidden from the bridge (`useCanOperate` hides the
 * controls up front).
 *
 * Each write refetches what it changed, so the tab shows the server's view
 * of the result, not the form's.
 */
const useMeasurementWrites = () => {
  const client = useQueryClient();
  const transport = useTransportStore((s) => s.transport);
  const host = useTransportStore((s) => s.host);

  return useMemo(() => {
    const driver = () => {
      if (!transport) throw new Error("not connected");
      return new ExperimentDriverClient(transport);
    };
    const refresh = (measurementId?: number) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["history", host, "measurements"] }),
        measurementId !== undefined &&
          client.invalidateQueries({ queryKey: ["history", host, "measurement", measurementId] }),
      ]);

    return {
      add: async (req: AddMeasurement) => {
        const { measurement_id } = await driver().add_measurement(req);
        await refresh(measurement_id);
        return measurement_id;
      },

      /**
       * One file per call: an upload is one bus message, capped at 15 MiB.
       * The reply's sha256 is checked against the bytes sent, so a file that
       * arrived damaged is reported rather than trusted.
       */
      attach: async (req: AttachMeasurementFile, file: Blob): Promise<AttachedFile> => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const [info, local] = await Promise.all([
          driver().attach_measurement_file(req, bytes, { timeoutMs: uploadTimeoutMs(bytes.length) }),
          sha256(bytes),
        ]);
        return { info, verified: local === null ? null : local === info.sha256 };
      },

      /** After a batch of `attach` calls: refetch once, not per file. */
      refresh,

      retireFile: async (file: MeasurementFileInfo, retire = true) => {
        await driver().retire_measurement_file({ file_id: file.file_id, retire });
        await refresh(file.measurement_id);
      },

      retireMeasurement: async (measurementId: number, retire = true) => {
        await driver().retire_measurement({ measurement_id: measurementId, retire });
        await refresh(measurementId);
      },
    };
  }, [client, transport, host]);
};

export default useMeasurementWrites;
