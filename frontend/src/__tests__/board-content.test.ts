import { describe, expect, it } from "vitest";

import { responseToBoardText } from "@/lib/board-content";
import type { AIResponse } from "@/types";

const r = (type: AIResponse["type"], data: unknown): AIResponse => ({ type, data });

describe("responseToBoardText", () => {
  it("flattens a fact with source", () => {
    expect(responseToBoardText(r("fact", { fact: "Light is fast.", source: "NASA" }))).toBe(
      "Light is fast.\n\nSource: NASA",
    );
  });

  it("numbers a list under its title", () => {
    expect(responseToBoardText(r("list", { title: "Uses", items: ["A", "B"] }))).toBe(
      "Uses\n\n1. A\n2. B",
    );
  });

  it("lays out a numerical with answer + reasoning", () => {
    const out = responseToBoardText(r("numerical", { problem: "KE?", answer: 9, unit: "J", reasoning: "0.5mv^2" }));
    expect(out).toContain("KE?");
    expect(out).toContain("Answer: 9 J");
    expect(out).toContain("0.5mv^2");
  });

  it("answer reads reasoning, with feedback fallback", () => {
    expect(responseToBoardText(r("answer", { answer: "42", reasoning: "because" }))).toBe("42\n\nbecause");
    expect(responseToBoardText(r("answer", { answer: "42", feedback: "legacy" }))).toBe("42\n\nlegacy");
  });

  it("image/chemistry fall back to a label", () => {
    expect(responseToBoardText(r("image", { prompt: "a neuron" }))).toBe("a neuron");
    expect(responseToBoardText(r("chemistry", { name: "Benzene" }))).toBe("Benzene");
  });

  it("unknown type falls back", () => {
    expect(responseToBoardText({ type: "totally_unknown" as AIResponse["type"], data: {} })).toBe(
      "Aura response",
    );
  });
});
