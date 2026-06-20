"use client";

import { DiagramDisplay } from "@/components/ai-panel/DiagramDisplay";
import { QuizDisplay } from "@/components/ai-panel/QuizDisplay";
import {
  AnswerDisplay,
  ExampleDisplay,
  ExplanationDisplay,
  FormatBoardDisplay,
  SummaryDisplay,
} from "@/components/ai-panel/displays";
import type { AIResponse } from "@/types";

/** Renders an AI response by its type. Shared by the workspace AI panel and the library. */
export function ResponseView({ response }: { response: AIResponse }) {
  const d = response.data as never;
  switch (response.type) {
    case "quiz":
      return <QuizDisplay data={d} />;
    case "summary":
      return <SummaryDisplay data={d} />;
    case "explanation":
      return <ExplanationDisplay data={d} />;
    case "example":
      return <ExampleDisplay data={d} />;
    case "diagram":
      return <DiagramDisplay data={d} />;
    case "format_board":
      return <FormatBoardDisplay data={d} />;
    default:
      return <AnswerDisplay data={d} />;
  }
}
