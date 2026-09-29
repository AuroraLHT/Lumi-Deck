import { Index3 } from "../../stores/rheedSim";

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** "(0 0 1)" / "[1 -1 0]": Miller notation, negative indices written with a minus. */
export const formatIndex = (v: number[], brackets: "()" | "[]") =>
  `${brackets[0]}${v.map((n) => (Number.isInteger(n) ? n : +n.toFixed(3))).join(" ")}${brackets[1]}`;

/**
 * Low-index directions [uvw] lying in the plane (hkl), shortest first, one of
 * each +/- pair -- the zone axes worth offering as the beam's azimuth.
 * Lengths are in index space, which is right for a cubic cell and a fair
 * ordering for the rest.
 */
export const inPlaneDirections = (normal: Index3, max = 6): Index3[] => {
  const found: Index3[] = [];
  const R = 2;
  for (let u = -R; u <= R; u++)
    for (let v = -R; v <= R; v++)
      for (let w = -R; w <= R; w++) {
        if (!u && !v && !w) continue;
        if (normal[0] * u + normal[1] * v + normal[2] * w !== 0) continue;
        if (gcd(gcd(u, v), w) !== 1) continue;
        // Keep the member of each +/- pair whose first non-zero index is positive.
        const first = [u, v, w].find((n) => n !== 0)!;
        if (first < 0) continue;
        found.push([u, v, w]);
      }
  const len = (d: Index3) => d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
  return found.sort((a, b) => len(a) - len(b)).slice(0, max);
};

/** Parse "1 -1 0", "1,-1,0" or "1-10" into three integers, or null. */
export const parseIndex = (text: string): Index3 | null => {
  const cleaned = text.replace(/[()[\]]/g, "").trim();
  let parts = cleaned.split(/[\s,]+/).filter(Boolean);
  // Compact form "1-10" / "001": single digits, each optionally negative.
  if (parts.length === 1) parts = cleaned.match(/-?\d/g) ?? [];
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  return nums.every(Number.isInteger) ? (nums as Index3) : null;
};

export const sameIndex = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);
