import {
  Box,
  Button,
  FormControl,
  HStack,
  Icon,
  Select,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";

import { useStructures, useStructureWrites } from "../../hooks/useRheedSim";
import { errorText, useCanOperate } from "../../hooks/useDriverCall";
import ConfirmButton from "../Controller/ConfirmButton";
import AddStructureModal from "./AddStructureModal";
import { FieldLabel } from "./fields";

const latticeLine = (l: { a: number; b: number; c: number; alpha?: number; beta?: number; gamma?: number }) => {
  const ang = [l.alpha ?? 90, l.beta ?? 90, l.gamma ?? 90];
  const lengths = l.a === l.b && l.b === l.c ? `a = ${l.a} Å` : `a ${l.a}, b ${l.b}, c ${l.c} Å`;
  return ang.every((x) => x === 90) ? lengths : `${lengths}; α β γ ${ang.join(", ")}°`;
};

/** Built-in structures, then saved ones; an operator can add a CIF or remove a saved one. */
const StructurePicker = ({ value, onChange }: { value: string; onChange: (name: string) => void }) => {
  const structures = useStructures();
  const writes = useStructureWrites();
  const canOperate = useCanOperate();
  const addModal = useDisclosure();
  const toast = useToast();

  const list = structures.data?.structures ?? [];
  const builtin = list.filter((s) => s.source === "builtin");
  const saved = list.filter((s) => s.source === "saved");
  const current = list.find((s) => s.name === value);
  const missing = structures.isSuccess && !current;

  const remove = async () => {
    try {
      await writes.remove(value);
      toast({ status: "success", title: `Deleted ${value}`, duration: 3000 });
      onChange(builtin[0]?.name ?? "SrTiO3");
    } catch (err) {
      toast({ status: "error", title: "Could not delete", description: errorText(err) });
    }
  };

  return (
    <Box>
      <FormControl isInvalid={missing}>
        <FieldLabel label="Structure" />
        <Select
          size="sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Structure"
          isDisabled={!structures.isSuccess}
          placeholder={structures.isPending ? "Loading…" : undefined}
        >
          {missing && <option value={value}>{value} (not on this node)</option>}
          <optgroup label="Built in">
            {builtin.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </optgroup>
          {saved.length > 0 && (
            <optgroup label="Saved">
              {saved.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </FormControl>

      {structures.isError && (
        <Text fontSize="xs" color="status.error" mt={1}>
          {structures.error.message}
        </Text>
      )}
      {current && (
        <Box fontSize="xs" color="text.secondary" mt={1.5}>
          <Text>
            <Text as="span" fontWeight="600" color="text.primary">
              {current.formula}
            </Text>{" "}
            · {current.space_group} · {current.n_atoms} atoms/cell
          </Text>
          <Text>{latticeLine(current.lattice)}</Text>
          {current.description && (
            <Text color="text.muted" mt={0.5}>
              {current.description}
            </Text>
          )}
        </Box>
      )}

      {canOperate && (
        <HStack mt={2} spacing={2}>
          <Button size="xs" variant="outline" leftIcon={<Icon as={LuPlus} />} onClick={addModal.onOpen}>
            Add from CIF
          </Button>
          {current?.source === "saved" && (
            <ConfirmButton
              size="xs"
              variant="ghost"
              colorScheme="red"
              leftIcon={<Icon as={LuTrash2} />}
              confirmLabel={`Delete the saved structure ${value}? This cannot be undone.`}
              onConfirm={remove}
            >
              Delete
            </ConfirmButton>
          )}
        </HStack>
      )}

      <AddStructureModal
        isOpen={addModal.isOpen}
        onClose={addModal.onClose}
        existing={list.map((s) => s.name)}
        onSaved={onChange}
      />
    </Box>
  );
};

export default StructurePicker;
