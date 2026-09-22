import { FormEvent, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Input,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Select,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import { LuAlertTriangle, LuTags, LuX } from "react-icons/lu";

import { FiducialMarker } from "../../generated/lumi";
import useFiducialRoles from "../../hooks/useFiducialRoles";
import useFiducialRoleControl from "../../hooks/useFiducialRoleControl";
import useFiducialUIStore from "../../stores/fiducialUI";

interface Props {
  markers: FiducialMarker[];
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Assigns role names to fiducial markers: "this one is the sample holder".
 *
 * The roles live on the node, not here (see `stores/fiducialRoles.ts`), and
 * exist so an automated step can ask for a marker by what it is *for* rather
 * than by an id that changes every time someone redraws it. This is the only
 * place an operator sets one, so it also has to be the place a broken one is
 * visible: the node keeps a role pointing at a removed marker, and only the
 * frontend knows which ids currently exist, so those are listed under a
 * warning rather than quietly hidden.
 *
 * Kept in a popover instead of inline in the toolbar because tagging is a
 * once-per-setup act, while the toolbar it hangs off is used every time
 * anybody draws anything.
 */
const FiducialRoleMenu = ({ markers }: Props) => {
  const { entries, dangling } = useFiducialRoles();
  const { setRole, removeRole } = useFiducialRoleControl();
  const selectedMarkerId = useFiducialUIStore((s) => s.selectedMarkerId);

  const [role, setRoleName] = useState("");
  // Empty means "follow the selection" -- picking a marker in the toolbar is
  // the natural way to say which one you are about to tag, so the select
  // tracks it until the operator overrides it here.
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Every button in here either unmounts (a cleared role's row) or would go
  // disabled (the submit, once its input is emptied) at the moment it is
  // clicked, and a focused element disappearing drops focus to the body --
  // which the popover reads as "focus left me" and shuts itself, hiding the
  // very result the operator clicked for. So focus is parked on the input
  // first, and the submit is never disabled; it just no-ops on empty input.
  const inputRef = useRef<HTMLInputElement>(null);

  const markerIds = markers.map((m) => m.marker_id);
  const targetId =
    (target && markerIds.includes(target) && target) ||
    (selectedMarkerId && markerIds.includes(selectedMarkerId) && selectedMarkerId) ||
    markerIds[0] ||
    "";

  const trimmed = role.trim();

  const assign = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    if (!targetId) {
      setError("Draw a marker on the video first -- a role has to point at one.");
      return;
    }
    setBusy(true);
    setError(null);
    inputRef.current?.focus();
    try {
      await setRole(trimmed, targetId);
      setRoleName("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const clear = (name: string) => {
    setError(null);
    inputRef.current?.focus();
    removeRole(name).catch((err) => setError(errorText(err)));
  };

  return (
    <Popover placement="bottom-start" isLazy>
      <Tooltip label="Assign marker roles" openDelay={400}>
        <Box display="inline-flex">
          <PopoverTrigger>
            <IconButton
              aria-label="Assign marker roles"
              icon={<LuTags />}
              size="xs"
              variant="panelGhost"
            />
          </PopoverTrigger>
        </Box>
      </Tooltip>

      <PopoverContent w="320px" className="no-drag">
        <PopoverArrow />
        <PopoverBody>
          <VStack align="stretch" spacing={2}>
            <Text fontSize="xs" fontWeight="600" color="text.muted">
              Marker roles
            </Text>

            {entries.length === 0 && (
              <Text fontSize="xs" color="text.muted">
                No roles yet -- name a marker below so automation can find it by
                purpose instead of by id.
              </Text>
            )}

            {entries.map(([name, markerId]) => {
              const broken = dangling.includes(name);
              return (
                <HStack key={name} spacing={2} fontSize="xs">
                  {/* Role names are matched byte for byte by whatever looks
                    * them up, so they are shown as typed -- a badge's default
                    * uppercasing would have an operator hunting for a
                    * "SAMPLE_HOLDER" that does not exist. */}
                  <Badge
                    colorScheme={broken ? "orange" : "purple"}
                    variant="subtle"
                    textTransform="none"
                  >
                    {name}
                  </Badge>
                  <Text color="text.muted">-&gt;</Text>
                  <Text
                    flex="1"
                    noOfLines={1}
                    color={broken ? "status.warn" : undefined}
                    title={
                      broken
                        ? `${markerId} is not on the node -- removed, or never drawn. Re-assign this role.`
                        : undefined
                    }
                  >
                    {markerId}
                    {broken && (
                      <Icon as={LuAlertTriangle} ml={1} verticalAlign="text-bottom" />
                    )}
                  </Text>
                  <IconButton
                    aria-label={`Clear role ${name}`}
                    icon={<LuX />}
                    size="xs"
                    variant="panelGhost"
                    onClick={() => clear(name)}
                  />
                </HStack>
              );
            })}

            {dangling.length > 0 && (
              <Text fontSize="xs" color="status.warn">
                {dangling.length === 1 ? "One role points" : `${dangling.length} roles point`}{" "}
                at a marker the node does not have. Re-assign or clear.
              </Text>
            )}

            <VStack as="form" align="stretch" spacing={2} pt={1} onSubmit={assign}>
              <Input
                size="xs"
                ref={inputRef}
                placeholder="Role name, e.g. sample_holder"
                value={role}
                list="fiducial-role-names"
                onChange={(e) => setRoleName(e.target.value)}
              />
              {/* Existing names offered back, so re-pointing a role is picking
                * it rather than retyping it exactly -- a typo here silently
                * creates a second role instead of moving the first. */}
              <datalist id="fiducial-role-names">
                {entries.map(([name]) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <HStack spacing={2}>
                <Select
                  size="xs"
                  flex="1"
                  value={targetId}
                  isDisabled={markers.length === 0}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {markers.map((marker) => (
                    <option key={marker.marker_id} value={marker.marker_id}>
                      {marker.marker_id}
                    </option>
                  ))}
                  {markers.length === 0 && <option value="">No markers drawn</option>}
                </Select>
                <Button type="submit" size="xs" colorScheme="blue">
                  {busy
                    ? "Assigning…"
                    : entries.some(([name]) => name === trimmed)
                    ? "Re-assign"
                    : "Assign"}
                </Button>
              </HStack>
            </VStack>

            {error && (
              <Text fontSize="xs" color="status.error">
                {error}
              </Text>
            )}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default FiducialRoleMenu;
