// Pure helpers for interactive responses — no React/DOM, unit-testable under
// the node vitest env.
import type { ChemistryData, NumericalData } from "@/types";

/** Strip thousands separators and a trailing unit token before comparison. */
function normalizeNumeric(raw: string, unit?: string | null): string {
  let s = raw.trim().replace(/,/g, "");
  if (unit) {
    const u = unit.trim().toLowerCase();
    if (u && s.toLowerCase().endsWith(u)) s = s.slice(0, s.length - u.length).trim();
  }
  return s;
}

/**
 * Check a user's answer against a numerical's expected answer.
 * - Numeric path: parse both; pass if within `tolerance` (absolute) when given,
 *   else within a relative 1% (with a tiny absolute floor for ~0 expected).
 * - String path (symbolic answers): case/space-insensitive equality.
 */
export function checkNumericAnswer(input: string, data: NumericalData): { correct: boolean } {
  const raw = (input ?? "").trim();
  if (!raw) return { correct: false };

  const expectedRaw = data.answer ?? "";
  const userNorm = normalizeNumeric(raw, data.unit);
  const expectedNorm = normalizeNumeric(String(expectedRaw), data.unit);

  const u = Number.parseFloat(userNorm);
  const e = Number.parseFloat(expectedNorm);
  if (Number.isFinite(u) && Number.isFinite(e)) {
    const tol =
      typeof data.tolerance === "number" && data.tolerance >= 0
        ? data.tolerance
        : Math.max(Math.abs(e) * 0.01, 1e-9);
    return { correct: Math.abs(u - e) <= tol };
  }

  // Symbolic / textual answer.
  const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
  return { correct: norm(raw) === norm(String(expectedRaw)) };
}

/** Decide how to render a chemistry payload: official image, client SMILES, or nothing. */
export function pickChemistrySource(
  data: ChemistryData,
): { mode: "image" | "smiles" | "none"; imageUrl?: string; smiles?: string } {
  if (data.imageUrl) return { mode: "image", imageUrl: data.imageUrl };
  if (data.smiles) return { mode: "smiles", smiles: data.smiles };
  return { mode: "none" };
}
