import { describe, expect, it } from "vitest";

import { checkNumericAnswer, pickChemistrySource } from "@/lib/response-checks";

describe("checkNumericAnswer", () => {
  it("exact numeric match", () => {
    expect(checkNumericAnswer("9", { answer: 9 }).correct).toBe(true);
  });

  it("within provided absolute tolerance", () => {
    expect(checkNumericAnswer("9.05", { answer: 9, tolerance: 0.1 }).correct).toBe(true);
    expect(checkNumericAnswer("9.5", { answer: 9, tolerance: 0.1 }).correct).toBe(false);
  });

  it("default relative tolerance (1%)", () => {
    expect(checkNumericAnswer("100.5", { answer: 100 }).correct).toBe(true); // within 1%
    expect(checkNumericAnswer("105", { answer: 100 }).correct).toBe(false);
  });

  it("strips units and thousands separators", () => {
    expect(checkNumericAnswer("9.8 m/s", { answer: 9.8, unit: "m/s" }).correct).toBe(true);
    expect(checkNumericAnswer("1,200", { answer: 1200 }).correct).toBe(true);
  });

  it("string match for symbolic answers (case/space-insensitive)", () => {
    expect(checkNumericAnswer("  X + 1 ", { answer: "x+1" }).correct).toBe(false); // spaces differ
    expect(checkNumericAnswer("x + 1", { answer: "X + 1" }).correct).toBe(true);
  });

  it("empty input is incorrect", () => {
    expect(checkNumericAnswer("", { answer: 9 }).correct).toBe(false);
    expect(checkNumericAnswer("   ", { answer: 9 }).correct).toBe(false);
  });

  it("handles expected near zero with absolute floor", () => {
    expect(checkNumericAnswer("0", { answer: 0 }).correct).toBe(true);
    expect(checkNumericAnswer("0.5", { answer: 0 }).correct).toBe(false);
  });
});

describe("pickChemistrySource", () => {
  it("prefers imageUrl", () => {
    expect(pickChemistrySource({ imageUrl: "u", smiles: "C" })).toEqual({ mode: "image", imageUrl: "u" });
  });
  it("falls back to smiles", () => {
    expect(pickChemistrySource({ smiles: "C1=CC=CC=C1" })).toEqual({ mode: "smiles", smiles: "C1=CC=CC=C1" });
  });
  it("none when neither", () => {
    expect(pickChemistrySource({ caption: "x" })).toEqual({ mode: "none" });
  });
});
