import { describe, expect, it } from "vitest";

import { speakableText } from "@/lib/tts";
import type { AIResponse } from "@/types";

const r = (type: AIResponse["type"], data: unknown): AIResponse => ({ type, data });

describe("speakableText", () => {
  it("summarizes a quiz by question count", () => {
    expect(speakableText(r("quiz", { questions: [1, 2, 3] }))).toBe("Quiz ready with 3 questions.");
  });

  it("reads summary text", () => {
    expect(speakableText(r("summary", { summary: "Cells are units of life." }))).toBe(
      "Cells are units of life.",
    );
  });

  it("reads an answer", () => {
    expect(speakableText(r("answer", { answer: "Oxygen" }))).toBe("Oxygen");
  });

  it("falls back gracefully", () => {
    expect(speakableText(r("format_board", {}))).toBe("Board formatted.");
  });
});
