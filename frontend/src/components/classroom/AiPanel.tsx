"use client";

import { Sparkles } from "lucide-react";

import { DiagramDisplay } from "@/components/ai-panel/DiagramDisplay";
import { QuizDisplay } from "@/components/ai-panel/QuizDisplay";
import {
  AnswerDisplay,
  ExampleDisplay,
  ExplanationDisplay,
  FormatBoardDisplay,
  SummaryDisplay,
} from "@/components/ai-panel/displays";
import { useSessionStore } from "@/store/sessionStore";
import type { AIResponse } from "@/types";

function renderResponse(r: AIResponse) {
  const d = r.data as never;
  switch (r.type) {
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

export function AiPanel() {
  const latest = useSessionStore((s) => s.latestResponse);
  const history = useSessionStore((s) => s.aiHistory);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-accent" /> AI
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!latest ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Sparkles className="h-7 w-7 text-accent" />
            <p className="max-w-[14rem] text-sm">
              Say <span className="font-medium text-foreground">“Hey Aura”</span> or type a command to
              generate a quiz, summary, explanation, and more.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r, i) => (
              <div key={r.commandId ?? i} className="rounded-xl border border-border bg-muted/40 p-3">
                <span className="inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                  {r.type}
                </span>
                <div className="mt-2">{renderResponse(r)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
