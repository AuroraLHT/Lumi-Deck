import { useEffect, useRef, useState } from "react";
import { Badge, HStack, Text, VStack } from "@chakra-ui/react";
import { Reorder } from "framer-motion";

import useChamberPldNodeStore from "../../stores/nodes/chamberPld";
import useOpConsoleStore from "../../stores/opConsole";
import OpCard from "./OpCard";
import OpPicker from "./OpPicker";
import { OP_REGISTRY, OpSpec } from "./opRegistry";
import Section from "./Section";

const OP_BY_ID = new Map(OP_REGISTRY.map((op) => [op.id, op]));

/**
 * Every driving op behind one search box. Picking an op opens it as the
 * preview card, which the next pick replaces; pinning a card keeps it, in a
 * list the operator orders by dragging. The preview always sits on top, so
 * a new pick lands right under the search box.
 *
 * The same RPCs serve both chamber drivers -- pld-service, and the legacy
 * MI-mode backup through PASCAL -- with the driver choosing the behavior, so
 * nothing here branches on it beyond saying which one is live: under legacy
 * MI mode some ops (set_pressure) raise a prompt for a person instead of
 * acting, and that prompt arrives on the card above like any other.
 */
const OperationConsole = ({ locked }: { locked: boolean }) => {
  const driver = useChamberPldNodeStore((s) => s.state.driver);
  const storedPins = useOpConsoleStore((s) => s.pinned);
  const setPinned = useOpConsoleStore((s) => s.setPinned);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  // Ops dropped from the registry since they were pinned are skipped.
  const pinned = storedPins.filter((id) => OP_BY_ID.has(id));
  const preview = previewId && !pinned.includes(previewId) ? previewId : null;
  const order = preview ? [preview, ...pinned] : pinned;

  useEffect(() => {
    if (!flashId) return;
    const t = window.setTimeout(() => setFlashId(null), 1200);
    return () => window.clearTimeout(t);
  }, [flashId]);

  const select = (op: OpSpec) => {
    if (pinned.includes(op.id)) {
      // Already on screen: point at it rather than opening a second copy.
      cards.current.get(op.id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setFlashId(op.id);
    } else {
      setPreviewId(op.id);
    }
  };

  const togglePin = (id: string) => {
    if (pinned.includes(id)) {
      // Unpinning makes it the preview, so it stays until the next pick.
      setPinned(pinned.filter((p) => p !== id));
      setPreviewId(id);
    } else {
      setPinned([id, ...pinned]);
      setPreviewId(null);
    }
  };

  const close = (id: string) => {
    if (id === preview) setPreviewId(null);
    else setPinned(pinned.filter((p) => p !== id));
  };

  return (
    <Section title="Operations">
      <VStack align="stretch" spacing={2}>
        <HStack spacing={2}>
          <OpPicker selectedId={preview} pinned={pinned} onSelect={select} />
          {driver && (
            <Badge
              variant="subtle"
              colorScheme={driver === "pld" ? "green" : "orange"}
              flexShrink={0}
              title={
                driver === "pld"
                  ? "Chamber driven through pld-service"
                  : "Chamber on the legacy MI-mode backup (PASCAL): some ops ask a person instead of acting"
              }
            >
              {driver === "pld" ? "pld-service" : "legacy MI"}
            </Badge>
          )}
        </HStack>
        {order.length === 0 ? (
          <Text fontSize="xs" color="text.muted">
            Search or pick an operation -- temperature, deposition, motion, gas, laser, target,
            logging, substrate. Pin one to keep it here.
          </Text>
        ) : (
          <Reorder.Group
            as="div"
            axis="y"
            values={order}
            // The preview is not draggable and stays first; only the pins reorder.
            onReorder={(ids: string[]) => setPinned(ids.filter((id) => id !== preview))}
            style={{ display: "flex", flexDirection: "column", gap: "8px" }}
          >
            {order.map((id) => (
              <OpCard
                key={id}
                op={OP_BY_ID.get(id)!}
                pinned={id !== preview}
                locked={locked}
                highlighted={id === flashId}
                onTogglePin={() => togglePin(id)}
                onClose={() => close(id)}
                cardRef={(el) => {
                  if (el) cards.current.set(id, el);
                  else cards.current.delete(id);
                }}
              />
            ))}
          </Reorder.Group>
        )}
      </VStack>
    </Section>
  );
};

export default OperationConsole;
