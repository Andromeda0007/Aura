"use client";

import { Check, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface Question {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}
interface QuizData {
  questions: Question[];
  shareCode?: string;
  error?: string;
}

export function QuizDisplay({ data }: { data: QuizData }) {
  const [picked, setPicked] = useState<Record<number, number>>({});

  if (data.error || !data.questions?.length) {
    return <p className="text-sm text-danger">{data.error ?? "No quiz available."}</p>;
  }

  const answered = Object.keys(picked).length;
  const score = Object.entries(picked).filter(
    ([i, opt]) => data.questions[Number(i)].answer_index === opt,
  ).length;
  const shareUrl =
    data.shareCode && typeof window !== "undefined"
      ? `${window.location.origin}/q/${data.shareCode}`
      : "";

  return (
    <div className="space-y-3">
      {data.shareCode && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="rounded-lg bg-white p-1.5">
            <QRCodeSVG value={shareUrl} size={64} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Share with students</p>
            <p className="font-mono text-sm font-semibold">{data.shareCode}</p>
            {answered > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Score: {score}/{answered}
              </p>
            )}
          </div>
        </div>
      )}

      {data.questions.map((q, qi) => {
        const chosen = picked[qi];
        const locked = chosen !== undefined;
        return (
          <div key={qi} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-2 space-y-1.5">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.answer_index;
                const isChosen = oi === chosen;
                return (
                  <button
                    key={oi}
                    disabled={locked}
                    onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      !locked && "border-border hover:bg-muted",
                      locked && isCorrect && "border-success/40 bg-success/10 text-success",
                      locked && isChosen && !isCorrect && "border-danger/40 bg-danger/10 text-danger",
                      locked && !isCorrect && !isChosen && "border-border opacity-60",
                    )}
                  >
                    <span>{opt}</span>
                    {locked && isCorrect && <Check className="h-4 w-4 shrink-0" />}
                    {locked && isChosen && !isCorrect && <X className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
            {locked && q.explanation && (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
