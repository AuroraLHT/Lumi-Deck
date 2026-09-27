import { useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { LuFileSpreadsheet, LuPlus, LuX } from "react-icons/lu";

import { MeasurementSeries } from "../../generated/lumi";
import useMeasurementWrites from "../../hooks/useMeasurementWrites";
import { errorText } from "../../hooks/useDriverCall";
import FilePicker from "./FilePicker";
import { PendingFile, UploadStatus, pendingFile, tooBig, useUploader } from "./uploads";
import {
  KNOWN_KINDS,
  MAX_FILE_BYTES,
  MAX_SERIES_VALUES,
  formatBytes,
  parseSeriesCsv,
  seriesValues,
  stem,
} from "./measurements";

interface DetailRow {
  key: string;
  name: string;
  value: string;
}

interface CurveFile {
  key: string;
  file: File;
  name: string;
  series: MeasurementSeries | null;
  error: string | null;
  logScale: boolean;
  /** Attach the file itself too, as `raw`, so the original survives the parse. */
  keepOriginal: boolean;
}

let nextKey = 0;
const key = () => `k${nextKey++}`;

/** "12" -> 12, "true" -> true, anything else stays text. */
const detailValue = (text: string): number | string | boolean => {
  const t = text.trim();
  if (t !== "" && Number.isFinite(Number(t))) return Number(t);
  if (t === "true" || t === "false") return t === "true";
  return t;
};

const Label = ({ children }: { children: string }) => (
  <FormLabel fontSize="sm" mb={1}>
    {children}
  </FormLabel>
);

/**
 * Record a measurement on a sample: a kind, an optional headline value (the
 * scalar an optimiser sorts on), named details, curves read from delimited
 * text files, and any files to keep with it.
 *
 * Saving is `add_measurement`, then one `attach_measurement_file` per file.
 * The measurement exists as soon as the first call returns, so a file that
 * fails to upload leaves the form open to retry just the files -- never a
 * second copy of the measurement.
 */
const AddMeasurementModal = ({
  sampleId,
  sampleName,
  isOpen,
  onClose,
}: {
  sampleId: number;
  sampleName: string;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const writes = useMeasurementWrites();
  const upload = useUploader();
  const toast = useToast();

  const [kind, setKind] = useState("");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [curves, setCurves] = useState<CurveFile[]>([]);
  const [files, setFiles] = useState<PendingFile[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once `add_measurement` succeeded: from then on only files are retried. */
  const [savedId, setSavedId] = useState<number | null>(null);

  const reset = () => {
    setKind("");
    setValue("");
    setSource("");
    setDetails([]);
    setCurves([]);
    setFiles([]);
    setError(null);
    setSavedId(null);
  };
  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const addCurves = async (list: FileList | null) => {
    for (const file of [...(list ?? [])]) {
      const curve: CurveFile = {
        key: key(),
        file,
        name: stem(file.name),
        series: null,
        error: null,
        logScale: false,
        keepOriginal: true,
      };
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error(`over ${formatBytes(MAX_FILE_BYTES)}; attach it as a file instead`);
        curve.series = parseSeriesCsv(await file.text(), curve.name);
      } catch (err) {
        curve.error = errorText(err);
      }
      setCurves((prev) => [...prev, curve]);
    }
  };
  const updateCurve = (k: string, patch: Partial<CurveFile>) =>
    setCurves((prev) => prev.map((c) => (c.key === k ? { ...c, ...patch } : c)));

  const series: MeasurementSeries[] = curves
    .filter((c) => c.series)
    .map((c) => ({
      ...c.series!,
      name: c.name.trim() || c.series!.name,
      meta: c.logScale ? { log_scale: true } : {},
    }));
  const nValues = seriesValues(series);

  const valueNumber = value.trim() === "" ? null : Number(value);
  const detailNames = details.map((d) => d.name.trim()).filter(Boolean);
  const problems = [
    !kind.trim() && "a kind",
    valueNumber !== null && !Number.isFinite(valueNumber) && "the value to be a number",
    new Set(detailNames).size !== detailNames.length && "detail names to be distinct",
    curves.some((c) => c.error) && "every curve file to parse (or be removed)",
    nValues > MAX_SERIES_VALUES && `curves under ${MAX_SERIES_VALUES.toLocaleString()} values in all`,
    files.some(tooBig) && `files under ${formatBytes(MAX_FILE_BYTES)}`,
  ].filter(Boolean) as string[];

  // The originals of parsed curves ride along as `raw` files.
  const [originals, setOriginals] = useState<PendingFile[]>([]);

  const setStatus = (k: string, status: UploadStatus) => {
    setFiles((prev) => prev.map((p) => (p.key === k ? { ...p, status } : p)));
    setOriginals((prev) => prev.map((p) => (p.key === k ? { ...p, status } : p)));
  };

  const save = async () => {
    if (problems.length) return;
    setSaving(true);
    setError(null);
    try {
      let id = savedId;
      let toUpload = [...originals, ...files];
      if (id === null) {
        id = await writes.add({
          sample_id: sampleId,
          kind: kind.trim(),
          value: valueNumber,
          detail: Object.fromEntries(
            details.filter((d) => d.name.trim()).map((d) => [d.name.trim(), detailValue(d.value)])
          ),
          series,
          source: source.trim() || null,
        });
        setSavedId(id);
        const raws = curves.filter((c) => c.series && c.keepOriginal).map((c) => pendingFile(c.file, "raw"));
        setOriginals(raws);
        toUpload = [...raws, ...files];
      }
      const failed = await upload(id, toUpload, setStatus);
      if (failed === 0) {
        toast({ status: "success", title: `Measurement ${id} saved`, duration: 4000 });
        reset();
        setOriginals([]);
        onClose();
      } else {
        setError(
          `Measurement ${id} is saved, but ${failed} file${failed === 1 ? "" : "s"} did not upload cleanly. Retry sends only those.`
        );
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const locked = saving || savedId !== null;

  return (
    <Modal isOpen={isOpen} onClose={close} size="xl" scrollBehavior="inside" closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">
          Add a measurement
          <Text fontSize="sm" fontWeight="400" color="text.secondary">
            on {sampleName}
          </Text>
        </ModalHeader>
        <ModalCloseButton isDisabled={saving} />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <HStack align="start" spacing={3}>
              <FormControl isRequired flex={1}>
                <Label>Kind</Label>
                <Input
                  size="sm"
                  list="measurement-kinds"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  placeholder="xrd, afm, transport…"
                  isDisabled={locked}
                />
                <datalist id="measurement-kinds">
                  {KNOWN_KINDS.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </FormControl>
              <FormControl w="150px" isInvalid={valueNumber !== null && !Number.isFinite(valueNumber)}>
                <Label>Value</Label>
                <Input
                  size="sm"
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="optional"
                  isDisabled={locked}
                />
              </FormControl>
            </HStack>
            <FormControl>
              <Label>Source</Label>
              <Input
                size="sm"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Instrument or method, e.g. XRD (Bruker D8)"
                isDisabled={locked}
              />
            </FormControl>

            <Box>
              <Label>Details</Label>
              <VStack align="stretch" spacing={1}>
                {details.map((d) => (
                  <HStack key={d.key} spacing={2}>
                    <Input
                      size="sm"
                      placeholder="name"
                      aria-label="Detail name"
                      value={d.name}
                      onChange={(e) =>
                        setDetails((prev) => prev.map((x) => (x.key === d.key ? { ...x, name: e.target.value } : x)))
                      }
                      isDisabled={locked}
                    />
                    <Input
                      size="sm"
                      placeholder="value"
                      aria-label="Detail value"
                      value={d.value}
                      onChange={(e) =>
                        setDetails((prev) => prev.map((x) => (x.key === d.key ? { ...x, value: e.target.value } : x)))
                      }
                      isDisabled={locked}
                    />
                    <IconButton
                      aria-label="Remove detail"
                      icon={<Icon as={LuX} />}
                      size="sm"
                      variant="ghost"
                      onClick={() => setDetails((prev) => prev.filter((x) => x.key !== d.key))}
                      isDisabled={locked}
                    />
                  </HStack>
                ))}
                <Button
                  size="xs"
                  variant="ghost"
                  alignSelf="start"
                  leftIcon={<Icon as={LuPlus} />}
                  onClick={() => setDetails((prev) => [...prev, { key: key(), name: "", value: "" }])}
                  isDisabled={locked}
                >
                  Add detail
                </Button>
              </VStack>
            </Box>

            <Box>
              <Label>Curves</Label>
              <Text fontSize="xs" color="text.muted" mb={2}>
                A text file of columns -- comma, tab or space separated: x first, then one or more y. A
                header row like <code>2theta (deg), intensity (counts)</code> names the axes and units.
              </Text>
              <VStack align="stretch" spacing={2}>
                {curves.map((c) => (
                  <Box key={c.key} fontSize="xs" borderBottom="1px solid" borderColor="panel.border" pb={2}>
                    <HStack spacing={2}>
                      <Input
                        size="xs"
                        flex={1}
                        aria-label={`Name of the curve from ${c.file.name}`}
                        value={c.name}
                        onChange={(e) => updateCurve(c.key, { name: e.target.value })}
                        isDisabled={locked}
                      />
                      <IconButton
                        aria-label={`Remove curve ${c.file.name}`}
                        icon={<Icon as={LuX} />}
                        size="xs"
                        variant="ghost"
                        onClick={() => setCurves((prev) => prev.filter((x) => x.key !== c.key))}
                        isDisabled={locked}
                      />
                    </HStack>
                    {c.error ? (
                      <Text color="status.error" mt={1}>
                        {c.file.name}: {c.error}
                      </Text>
                    ) : (
                      c.series && (
                        <>
                          <Text color="text.muted" mt={1}>
                            {c.series.x.values.length} points · x {c.series.x.name}
                            {c.series.x.unit && ` (${c.series.x.unit})`} · y{" "}
                            {c.series.y.map((y) => (y.unit ? `${y.name} (${y.unit})` : y.name)).join(", ")}
                          </Text>
                          <HStack spacing={4} mt={1}>
                            <Checkbox
                              size="sm"
                              isChecked={c.logScale}
                              onChange={(e) => updateCurve(c.key, { logScale: e.target.checked })}
                              isDisabled={locked}
                            >
                              <Text fontSize="xs">Log scale</Text>
                            </Checkbox>
                            <Checkbox
                              size="sm"
                              isChecked={c.keepOriginal}
                              onChange={(e) => updateCurve(c.key, { keepOriginal: e.target.checked })}
                              isDisabled={locked}
                            >
                              <Text fontSize="xs">Also keep {c.file.name} as a raw file</Text>
                            </Checkbox>
                          </HStack>
                        </>
                      )
                    )}
                  </Box>
                ))}
                <Button
                  as="label"
                  size="xs"
                  variant="ghost"
                  alignSelf="start"
                  leftIcon={<Icon as={LuFileSpreadsheet} />}
                  cursor={locked ? "not-allowed" : "pointer"}
                  isDisabled={locked}
                >
                  Add curve from file
                  <input
                    type="file"
                    multiple
                    accept=".csv,.tsv,.txt,.dat,.xy,text/*"
                    hidden
                    disabled={locked}
                    aria-label="Curve files"
                    onChange={(e) => {
                      addCurves(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </Button>
                {nValues > MAX_SERIES_VALUES && (
                  <Text fontSize="xs" color="status.error">
                    {nValues.toLocaleString()} values in all; the limit is {MAX_SERIES_VALUES.toLocaleString()}.
                    Attach the data as a file instead.
                  </Text>
                )}
              </VStack>
            </Box>

            <FormControl>
              <Label>Files</Label>
              <FilePicker files={files} onChange={setFiles} isDisabled={saving} />
              {originals.length > 0 && (
                <FormHelperText>
                  {originals.map((o) => (
                    <Text key={o.key} fontSize="xs">
                      {o.file.name} (raw, from a curve): {o.status.state}
                      {o.status.state === "failed" && ` -- ${o.status.error}`}
                    </Text>
                  ))}
                </FormHelperText>
              )}
            </FormControl>

            {error && (
              <Alert status={savedId !== null ? "warning" : "error"} borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          {problems.length > 0 && (
            <Text fontSize="xs" color="text.muted" mr="auto">
              Needs {problems.join(", ")}.
            </Text>
          )}
          <Button size="sm" variant="ghost" onClick={close} isDisabled={saving}>
            {savedId !== null ? "Close" : "Cancel"}
          </Button>
          <Button size="sm" colorScheme="blue" onClick={save} isLoading={saving} isDisabled={problems.length > 0}>
            {savedId !== null ? "Retry files" : "Save"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddMeasurementModal;
