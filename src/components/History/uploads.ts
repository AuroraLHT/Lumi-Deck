import useMeasurementWrites from "../../hooks/useMeasurementWrites";
import { errorText } from "../../hooks/useDriverCall";
import { MAX_FILE_BYTES } from "./measurements";

export type UploadStatus =
  | { state: "waiting" }
  | { state: "uploading" }
  | { state: "done"; verified: boolean | null }
  | { state: "failed"; error: string };

export interface PendingFile {
  key: string;
  file: File;
  role: string;
  description: string;
  status: UploadStatus;
}

let nextKey = 0;

export const pendingFile = (file: File, role?: string): PendingFile => ({
  key: `f${nextKey++}`,
  file,
  role: role ?? (file.type.startsWith("image/") ? "image" : "raw"),
  description: "",
  status: { state: "waiting" },
});

export const tooBig = (p: PendingFile) => p.file.size > MAX_FILE_BYTES;

/**
 * Upload each file still to go, one at a time (each is one bus message), and
 * report as each lands. A failure does not stop the rest: the measurement
 * already exists, and the files that made it are kept.
 */
export const useUploader = () => {
  const writes = useMeasurementWrites();
  return async (
    measurementId: number,
    files: PendingFile[],
    onStatus: (key: string, status: UploadStatus) => void
  ) => {
    let failed = 0;
    for (const p of files) {
      if (p.status.state === "done") continue;
      onStatus(p.key, { state: "uploading" });
      try {
        const { verified } = await writes.attach(
          {
            measurement_id: measurementId,
            file_name: p.file.name,
            media_type: p.file.type || null,
            role: p.role,
            description: p.description.trim() || null,
          },
          p.file
        );
        onStatus(p.key, { state: "done", verified });
        if (verified === false) failed += 1;
      } catch (err) {
        failed += 1;
        onStatus(p.key, { state: "failed", error: errorText(err) });
      }
    }
    await writes.refresh(measurementId);
    return failed;
  };
};
