import { MeasurementFileInfo, MeasurementSeries, SeriesAxis } from "../../generated/lumi";

/**
 * One upload is one bus message, and RabbitMQ and the browser websocket both
 * stop at 16 MiB -- the backend refuses past 15 MiB
 * (`experiment.measurement_file_max_bytes`). Checked here first so a big file
 * fails before it is read, not after it is sent.
 */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** The backend's cap on a measurement's curves, x and y values together. */
export const MAX_SERIES_VALUES = 200_000;

/** Kinds the growth history already uses; the picker also takes any other. */
export const KNOWN_KINDS = ["xrd", "afm", "pfm", "transport", "rheed_metric"];

/** File roles by convention -- `image` is the one shown inline. */
export const FILE_ROLES = ["raw", "image", "map", "data", "other"] as const;

export const formatBytes = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const isImage = (file: Pick<MeasurementFileInfo, "media_type">) =>
  file.media_type.startsWith("image/");

export const seriesValues = (series: MeasurementSeries[]) =>
  series.reduce((n, s) => n + s.x.values.length * (1 + s.y.length), 0);

/** "2theta (deg)" / "R [ohm]" -> name and unit; anything else is all name. */
const axisHeader = (header: string): Pick<SeriesAxis, "name" | "unit"> => {
  const m = header.trim().match(/^(.*?)\s*[([]\s*([^)\]]*)\s*[)\]]\s*$/);
  return m && m[1] ? { name: m[1], unit: m[2] || null } : { name: header.trim(), unit: null };
};

const splitRow = (line: string) =>
  line.includes(",") ? line.split(",") : line.includes("\t") ? line.split("\t") : line.trim().split(/\s+/);

/**
 * A delimited text file -> one series: the first column is x, every other
 * column a y. Commas, tabs or runs of spaces all work; `#` lines are skipped;
 * a first row that is not numbers is the header, read as `name (unit)`.
 *
 * Throws with a reason a person can act on. Rows that are not all numbers
 * after the header are an error rather than skipped, since quietly dropping
 * rows from a measurement is how a curve ends up wrong without anyone knowing.
 */
export const parseSeriesCsv = (text: string, name: string): MeasurementSeries => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (!lines.length) throw new Error("the file is empty");

  let rows = lines.map(splitRow);
  const numeric = (cells: string[]) => cells.every((c) => c.trim() !== "" && Number.isFinite(Number(c)));

  let headers: string[] | null = null;
  if (!numeric(rows[0])) {
    headers = rows[0];
    rows = rows.slice(1);
  }
  const width = headers?.length ?? rows[0]?.length ?? 0;
  if (width < 2) throw new Error("need at least two columns: x, then one or more y");
  if (!rows.length) throw new Error("no data rows after the header");

  const columns: number[][] = Array.from({ length: width }, () => []);
  rows.forEach((cells, i) => {
    if (cells.length !== width || !numeric(cells)) {
      const line = i + 1 + (headers ? 1 : 0);
      throw new Error(`line ${line} is not ${width} numbers: "${cells.join(", ").slice(0, 60)}"`);
    }
    cells.forEach((c, j) => columns[j].push(Number(c)));
  });

  const axis = (j: number): SeriesAxis => ({
    ...(headers ? axisHeader(headers[j]) : { name: j === 0 ? "x" : width === 2 ? "y" : `y${j}`, unit: null }),
    values: columns[j],
  });

  return { name, x: axis(0), y: columns.slice(1).map((_, j) => axis(j + 1)), meta: {} };
};

/** "scan_2theta-omega.csv" -> "scan_2theta-omega". */
export const stem = (fileName: string) => fileName.replace(/\.[^.]+$/, "");
