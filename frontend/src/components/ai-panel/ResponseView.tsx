"use client";

import { ChemistryDisplay } from "@/components/ai-panel/ChemistryDisplay";
import { DiagramDisplay } from "@/components/ai-panel/DiagramDisplay";
import { ImageDisplay } from "@/components/ai-panel/ImageDisplay";
import { NumericalDisplay } from "@/components/ai-panel/NumericalDisplay";
import { QuizDisplay } from "@/components/ai-panel/QuizDisplay";
import {
  AnswerDisplay,
  ExampleDisplay,
  ExplanationDisplay,
  FactDisplay,
  FormatBoardDisplay,
  ListDisplay,
  SummaryDisplay,
} from "@/components/ai-panel/displays";
import type { AIResponse } from "@/types";

/** Renders an AI response by its type. Shared by the workspace AI panel and the library. */
export function ResponseView({
  response,
  onRegenerate,
}: {
  response: AIResponse;
  onRegenerate?: () => void;
}) {
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
      return <DiagramDisplay data={d} onRegenerate={onRegenerate} />;
    case "format_board":
      return <FormatBoardDisplay data={d} />;
    case "fact":
      return <FactDisplay data={d} />;
    case "list":
      return <ListDisplay data={d} />;
    case "numerical":
      return <NumericalDisplay data={d} />;
    case "image":
      return <ImageDisplay data={d} />;
    case "chemistry":
      return <ChemistryDisplay data={d} />;
    case "answer":
      return <AnswerDisplay data={d} />;
    default:
      return <AnswerDisplay data={d} />;
  }
}
