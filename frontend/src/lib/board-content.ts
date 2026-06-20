// Turns an Aura response into clean text for the whiteboard, plus the small
// drag payload shape shared between the AI panel (drag source) and the board
// (drop target).
import type { AIResponse } from "@/types";

export const BOARD_DND_MIME = "application/x-aura-board";

export interface BoardDragPayload {
  kind: "text" | "svg";
  text?: string; // formatted text for kind === "text"
  svg?: string; // raw SVG markup for kind === "svg" (diagrams)
}

const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

interface QuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
}

/** Flatten an AI response into readable multi-line text for a board text shape. */
export function responseToBoardText(r: AIResponse): string {
  switch (r.type) {
    case "summary": {
      const d = r.data as { summary?: string; keyPoints?: string[] };
      const blocks: string[] = [];
      if (d.summary?.trim()) blocks.push(d.summary.trim());
      if (d.keyPoints?.length) blocks.push(d.keyPoints.map((k) => `• ${k}`).join("\n"));
      return blocks.join("\n\n") || "Summary";
    }
    case "explanation": {
      const d = r.data as { explanation?: string; nextTopics?: string[] };
      const blocks: string[] = [];
      if (d.explanation?.trim()) blocks.push(d.explanation.trim());
      if (d.nextTopics?.length) blocks.push(`Next: ${d.nextTopics.join(", ")}`);
      return blocks.join("\n\n") || "Explanation";
    }
    case "example": {
      const d = r.data as { problem?: string; solution?: string; correct_answer?: string };
      const blocks: string[] = [];
      if (d.problem?.trim()) blocks.push(d.problem.trim());
      if (d.solution?.trim()) blocks.push(`Solution: ${d.solution.trim()}`);
      if (d.correct_answer?.trim()) blocks.push(`Answer: ${d.correct_answer.trim()}`);
      return blocks.join("\n\n") || "Example";
    }
    case "answer": {
      const d = r.data as { answer?: string; feedback?: string };
      const blocks: string[] = [];
      if (d.answer?.trim()) blocks.push(d.answer.trim());
      if (d.feedback?.trim() && d.feedback !== d.answer) blocks.push(d.feedback.trim());
      return blocks.join("\n\n") || "Answer";
    }
    case "quiz": {
      const d = r.data as { questions?: QuizQuestion[] };
      const qs = d.questions ?? [];
      if (!qs.length) return "Quiz";
      const body = qs
        .map((q, i) => {
          const opts = q.options.map((o, oi) => `   ${LETTERS[oi] ?? oi + 1}) ${o}`);
          return [`${i + 1}. ${q.question}`, ...opts].join("\n");
        })
        .join("\n\n");
      const key = qs
        .map((q, i) => `${i + 1}. ${LETTERS[q.answer_index] ?? q.answer_index + 1}) ${q.options[q.answer_index] ?? ""}`)
        .join("\n");
      return ["Quiz", body, `Answer key:\n${key}`].join("\n\n");
    }
    case "format_board": {
      const d = r.data as { blocks?: string[] };
      return (d.blocks ?? []).join("\n") || "Notes";
    }
    case "diagram": {
      const d = r.data as { title?: string };
      return d.title?.trim() || "Diagram";
    }
    default:
      return "Aura response";
  }
}
