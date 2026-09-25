import { ReactNode, useEffect, useState } from "react";
import { Box, Button, HStack, Icon, Input, Select, Text, VStack } from "@chakra-ui/react";
import { LuAlertTriangle } from "react-icons/lu";

import { PendingConfirmation } from "../../generated/lumi";
import useDriverCall from "../../hooks/useDriverCall";
import useFiducialMarkers from "../../hooks/useFiducialMarkers";
import useFiducialRoleControl from "../../hooks/useFiducialRoleControl";
import useExperimentDriverStore from "../../stores/experimentDriver";
import useFiducialUIStore from "../../stores/fiducialUI";
import { MASK_CENTER_ROLE } from "./maskAlign";

type Call = ReturnType<typeof useDriverCall>;

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * `fiducial_role`: auto-alignment is waiting for a marker tagged `mask-center`.
 *
 * Tagging one is the whole answer -- the backend polls for it and carries on
 * by itself, so there is no "done" button. The marker picker is here, not
 * only in the camera panel's role menu, so the operator can answer the prompt
 * where they see it; picking a marker also selects it, which highlights it on
 * the camera so they can check it is the one on the sample's center.
 *
 * `confirm` on this kind *cancels* the alignment, hence the button's wording.
 */
const FiducialRolePrompt = ({ pending, call }: { pending: PendingConfirmation; call: Call }) => {
  const { markers } = useFiducialMarkers();
  const { setRole } = useFiducialRoleControl();
  const selected = useFiducialUIStore((s) => s.selectedMarkerId);
  const setSelected = useFiducialUIStore((s) => s.selectMarker);
  const [tagging, setTagging] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const ids = markers.map((m) => m.marker_id);
  const target = selected && ids.includes(selected) ? selected : ids[0] ?? "";

  const tag = async () => {
    if (!target) return;
    setTagging(true);
    setTagError(null);
    try {
      await setRole(MASK_CENTER_ROLE, target);
    } catch (err) {
      setTagError(errorText(err));
    } finally {
      setTagging(false);
    }
  };

  return (
    <>
      {ids.length === 0 ? (
        <Text fontSize="xs" color="text.muted">
          No markers yet -- draw one on the Chamber Camera panel over the sample's center.
        </Text>
      ) : (
        <HStack spacing={2}>
          <Select
            size="xs"
            flex="1"
            aria-label="Marker on the sample's center"
            value={target}
            onChange={(e) => setSelected(e.target.value)}
          >
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </Select>
          <Button
            size="xs"
            colorScheme="blue"
            isLoading={tagging}
            isDisabled={!call.canOperate}
            onClick={tag}
          >
            Tag as {MASK_CENTER_ROLE}
          </Button>
        </HStack>
      )}
      {tagError && (
        <Text fontSize="xs" color="status.error">
          {tagError}
        </Text>
      )}
      <HStack>
        <Button
          size="xs"
          variant="outline"
          colorScheme="red"
          isLoading={call.busy}
          isDisabled={!call.canOperate}
          onClick={() => call.run((c) => c.confirm({ confirmation_id: pending.id }))}
        >
          Cancel alignment
        </Button>
      </HStack>
    </>
  );
};

/** A number field plus the button that submits it. */
const NumberPrompt = ({
  label,
  unit,
  initial = "",
  action,
  onSubmit,
  call,
  extra,
}: {
  label: string;
  unit: string;
  initial?: string;
  action: string;
  onSubmit: (value: number) => void;
  call: Call;
  extra?: ReactNode;
}) => {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const n = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(n);
  return (
    <HStack spacing={2} flexWrap="wrap" rowGap={2}>
      <Input
        size="xs"
        type="number"
        w="110px"
        aria-label={label}
        placeholder={unit}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        size="xs"
        colorScheme="blue"
        isLoading={call.busy}
        isDisabled={!call.canOperate || !valid}
        onClick={() => onSubmit(n)}
      >
        {action}
      </Button>
      {extra}
    </HStack>
  );
};

/** Reads Mask1's position into a field -- the value being confirmed is usually "where it is now". */
const useMaskPosition = (call: Call) => {
  const [position, setPosition] = useState("");
  const read = () =>
    call.run((c) => c.get_current_mask_position()).then((r) => {
      if (r) setPosition(String(r.position));
    });
  return { position, read };
};

const MaskAlignmentPrompt = ({ call }: { call: Call }) => {
  const { position, read } = useMaskPosition(call);
  return (
    <NumberPrompt
      label="Mask center position"
      unit="mm"
      initial={position}
      action="Confirm center"
      call={call}
      onSubmit={(p) => call.run((c) => c.confirm_center_mask({ position: p }))}
      extra={
        <Button size="xs" variant="ghost" onClick={read}>
          Read current
        </Button>
      }
    />
  );
};

const MaskCheckPrompt = ({ call }: { call: Call }) => {
  const { position, read } = useMaskPosition(call);
  return (
    <VStack align="stretch" spacing={2}>
      <HStack>
        <Button
          size="xs"
          colorScheme="green"
          isLoading={call.busy}
          isDisabled={!call.canOperate}
          onClick={() => call.run((c) => c.confirm_mask_center({ aligned: true }))}
        >
          Yes, centered
        </Button>
      </HStack>
      <Text fontSize="xs" color="text.muted">
        Not centered? Move it there, then send the corrected position:
      </Text>
      <NumberPrompt
        label="Corrected mask position"
        unit="mm"
        initial={position}
        action="Not centered -- use this"
        call={call}
        onSubmit={(p) =>
          call.run((c) => c.confirm_mask_center({ aligned: false, corrected_position: p }))
        }
        extra={
          <Button size="xs" variant="ghost" onClick={read}>
            Read current
          </Button>
        }
      />
    </VStack>
  );
};

const RheedGainPrompt = ({ call }: { call: Call }) => (
  <VStack align="stretch" spacing={2}>
    <NumberPrompt
      label="RHEED gain"
      unit="0-240"
      action="Try gain"
      call={call}
      onSubmit={(gain) => call.run((c) => c.set_rheed_gain({ gain }))}
    />
    <HStack>
      <Button
        size="xs"
        colorScheme="green"
        isLoading={call.busy}
        isDisabled={!call.canOperate}
        onClick={() => call.run((c) => c.confirm_rheed_gain())}
      >
        Keep current gain
      </Button>
    </HStack>
  </VStack>
);

const PixelCheckPrompt = ({ call }: { call: Call }) => {
  const status = useExperimentDriverStore((s) => s.pixelStatus);
  const setStatus = useExperimentDriverStore((s) => s.setPixelStatus);
  const resolve = (keep: boolean) =>
    call.run((c) => c.resolve_pixel_check({ keep })).then((next) => {
      if (next) setStatus(next);
    });
  return (
    <VStack align="stretch" spacing={2}>
      {status && status.index != null && (
        <Text fontSize="xs" color="text.muted">
          Pixel {status.index} at {status.position?.toFixed(2)} mm (mask{" "}
          {status.mask_position?.toFixed(2)}, RHEED {status.rheed_position?.toFixed(2)})
          {status.dropped && status.dropped.length > 0 && ` · dropped so far: ${status.dropped.join(", ")}`}
        </Text>
      )}
      <HStack>
        <Button
          size="xs"
          colorScheme="green"
          isLoading={call.busy}
          isDisabled={!call.canOperate}
          onClick={() => resolve(true)}
        >
          Keep
        </Button>
        <Button
          size="xs"
          colorScheme="red"
          variant="outline"
          isLoading={call.busy}
          isDisabled={!call.canOperate}
          onClick={() => resolve(false)}
        >
          Drop
        </Button>
      </HStack>
    </VStack>
  );
};

const LaserPowerPrompt = ({ call }: { call: Call }) => (
  <NumberPrompt
    label="Measured laser power"
    unit="W"
    action="Confirm reading"
    call={call}
    onSubmit={(measured_power) => call.run((c) => c.confirm_laser_power({ measured_power }))}
  />
);

/** A kind this panel has no controls for: show it, and let it be acknowledged. */
const GenericPrompt = ({ pending, call }: { pending: PendingConfirmation; call: Call }) => (
  <HStack>
    <Button
      size="xs"
      isLoading={call.busy}
      isDisabled={!call.canOperate}
      onClick={() => call.run((c) => c.confirm({ confirmation_id: pending.id }))}
    >
      Acknowledge
    </Button>
  </HStack>
);

const TITLES: Record<string, string> = {
  fiducial_role: "Waiting for the mask-center marker",
  mask_center_alignment: "Manual mask-center alignment",
  mask_center_check: "Is the mask centered?",
  rheed_gain: "Tune RHEED gain",
  pixel_check: "Pixel check",
  laser_power: "Laser power",
};

/**
 * The decision the driver is currently waiting on, with the controls that
 * answer it. There is at most one at a time on the backend, so this is one
 * card, keyed by the confirmation id so a new prompt starts with fresh fields.
 */
const PendingConfirmationCard = ({ pending }: { pending: PendingConfirmation }) => {
  const call = useDriverCall();

  let body: ReactNode;
  switch (pending.kind) {
    case "fiducial_role":
      body = <FiducialRolePrompt pending={pending} call={call} />;
      break;
    case "mask_center_alignment":
      body = <MaskAlignmentPrompt call={call} />;
      break;
    case "mask_center_check":
      body = <MaskCheckPrompt call={call} />;
      break;
    case "rheed_gain":
      body = <RheedGainPrompt call={call} />;
      break;
    case "pixel_check":
      body = <PixelCheckPrompt call={call} />;
      break;
    case "laser_power":
      body = <LaserPowerPrompt call={call} />;
      break;
    default:
      body = <GenericPrompt pending={pending} call={call} />;
  }

  return (
    <Box
      borderWidth="1px"
      borderColor="status.warn"
      borderRadius="md"
      p={2}
      role="alert"
      aria-label="Driver waiting for operator"
    >
      <VStack align="stretch" spacing={2}>
        <HStack spacing={1} color="status.warn">
          <Icon as={LuAlertTriangle} />
          <Text fontSize="xs" fontWeight="600">
            {TITLES[pending.kind] ?? `Waiting: ${pending.kind}`}
          </Text>
        </HStack>
        <Text fontSize="xs">{pending.message}</Text>
        {body}
        {/* The generic `confirm` clears any gate. Offered for the operator
          * flows so one started by mistake can be backed out of without
          * answering it -- "align by hand" would otherwise force a position
          * into the calibration. Not for `fiducial_role`, whose own cancel
          * button is this same call, and not for unknown kinds, whose only
          * button already is. */}
        {pending.kind in TITLES && pending.kind !== "fiducial_role" && (
          <HStack>
            <Button
              size="xs"
              variant="ghost"
              isDisabled={!call.canOperate || call.busy}
              title="Close this prompt without answering it"
              onClick={() => call.run((c) => c.confirm({ confirmation_id: pending.id }))}
            >
              Dismiss
            </Button>
          </HStack>
        )}
        {call.error && (
          <Text fontSize="xs" color="status.error">
            {call.error}
          </Text>
        )}
        {!call.canOperate && (
          <Text fontSize="xs" color="text.muted">
            Operator access is needed to answer this.
          </Text>
        )}
      </VStack>
    </Box>
  );
};

export default PendingConfirmationCard;
