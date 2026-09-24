import { MaskAlignResult } from "../../generated/lumi";

export const AUTO_ALIGN_KIND = "auto_align_center_mask";

/** The role mask auto-alignment reads; also named in its `fiducial_role` prompt. */
export const MASK_CENTER_ROLE = "mask-center";

/**
 * A `task_result` that carries a `MaskAlignResult`. The event names the op
 * (`finished_task`), but the payload is `Record<string, unknown>` on the
 * wire, so the shape is still checked before it is read as one.
 */
export const isMaskAlignResult = (
  data: Record<string, unknown>
): data is Record<string, unknown> & MaskAlignResult =>
  data.ok === true && typeof data.center === "number" && typeof data.previous_center === "number";
