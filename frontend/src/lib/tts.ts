import type { AIResponse } from "@/types";

/** Extract a short speakable string from an AI response. */
export function speakableText(r: AIResponse): string {
  const d = (r.data ?? {}) as Record<string, unknown>;
  switch (r.type) {
    case "quiz": {
      const n = Array.isArray(d.questions) ? d.questions.length : 0;
      return `Quiz ready with ${n} questions.`;
    }
    case "summary":
      return String(d.summary ?? "Summary ready.");
    case "explanation":
      return String(d.explanation ?? "Explanation ready.");
    case "example":
      return String(d.problem ?? "Example ready.");
    case "answer":
      return String(d.answer ?? d.feedback ?? "Answer ready.");
    case "diagram":
      return String(d.title ?? "Diagram ready.");
    case "format_board":
      return "Board formatted.";
    default:
      return "Response ready.";
  }
}

/** Speak text via the browser SpeechSynthesis API (no-op if unsupported). */
export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 600));
  u.rate = 1.05;
  synth.speak(u);
}
