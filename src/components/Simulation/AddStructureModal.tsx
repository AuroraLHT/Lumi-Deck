import { useEffect, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { LuFileUp } from "react-icons/lu";

import { useStructureWrites } from "../../hooks/useRheedSim";
import { errorText } from "../../hooks/useDriverCall";

/** The node's own rule for a structure name. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.+()-]{0,63}$/;
/** The contract's cap on a CIF's text. */
const MAX_CIF_CHARS = 4_000_000;

/** A name from the CIF's file name, cut to what the node accepts. */
const nameFromFile = (fileName: string) =>
  fileName
    .replace(/\.cif$/i, "")
    .replace(/[^A-Za-z0-9_.+()-]/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 64);

/**
 * Keep a CIF under a name, so a scene can refer to it. The node parses it
 * first and refuses one it cannot simulate, so the error it gives back is
 * shown as it is -- it says what in the file was wrong.
 */
const AddStructureModal = ({
  isOpen,
  onClose,
  existing,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  existing: string[];
  onSaved: (name: string) => void;
}) => {
  const writes = useStructureWrites();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cif, setCif] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setDescription("");
    setCif("");
    setOverwrite(false);
    setError(null);
  }, [isOpen]);

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CIF_CHARS) {
      setError(`${file.name} is over the ${MAX_CIF_CHARS / 1e6} MB a CIF may be.`);
      return;
    }
    setCif(await file.text());
    setError(null);
    if (!name) setName(nameFromFile(file.name));
  };

  const nameOk = NAME.test(name);
  const taken = existing.includes(name);
  const canSave = nameOk && cif.trim().length > 0 && (!taken || overwrite) && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const info = await writes.save({ name, description, cif, overwrite });
      toast({ status: "success", title: `Saved ${info.name}`, description: `${info.formula} · ${info.space_group}`, duration: 4000 });
      onSaved(info.name);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add a structure</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <FormControl>
              <FormLabel fontSize="sm">CIF</FormLabel>
              <HStack mb={2}>
                <Button size="sm" variant="outline" leftIcon={<Icon as={LuFileUp} />} onClick={() => fileInput.current?.click()}>
                  Choose a .cif file
                </Button>
                <Text fontSize="xs" color="text.muted">
                  or paste its text below
                </Text>
              </HStack>
              <input
                ref={fileInput}
                type="file"
                accept=".cif,chemical/x-cif,text/plain"
                hidden
                aria-label="Choose a CIF file"
                onChange={(e) => {
                  readFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Textarea
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                fontFamily="mono"
                fontSize="xs"
                rows={8}
                placeholder="data_…"
                aria-label="CIF text"
              />
            </FormControl>

            <FormControl isInvalid={name !== "" && (!nameOk || (taken && !overwrite))}>
              <FormLabel fontSize="sm">Name</FormLabel>
              <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NdNiO3-pc" />
              {name !== "" && !nameOk ? (
                <FormErrorMessage>
                  Up to 64 letters, digits and _ . + - ( ), starting with a letter or digit.
                </FormErrorMessage>
              ) : taken && !overwrite ? (
                <FormErrorMessage>There is already a structure called {name}.</FormErrorMessage>
              ) : (
                <FormHelperText fontSize="xs">What the scene and its saved settings will call it.</FormHelperText>
              )}
            </FormControl>
            {taken && (
              <Checkbox size="sm" isChecked={overwrite} onChange={(e) => setOverwrite(e.target.checked)}>
                Replace the saved {name}
              </Checkbox>
            )}

            <FormControl>
              <FormLabel fontSize="sm">Description</FormLabel>
              <Input
                size="sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder="Optional: where the cell came from"
              />
            </FormControl>

            {error && (
              <Text fontSize="sm" color="status.error" whiteSpace="pre-wrap">
                {error}
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button size="sm" variant="ghost" onClick={onClose} isDisabled={busy}>
            Cancel
          </Button>
          <Button size="sm" colorScheme="blue" onClick={save} isLoading={busy} isDisabled={!canSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddStructureModal;
