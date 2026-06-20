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

interface Props {
  data: QuizData;
  /** When provided, the card runs in student-attempt mode: answers are
   * editable until submitted, nothing is revealed until then. */
  onSubmit?: (answers: number[]) => Promise<void> | void;
}

export function QuizDisplay({ data, onSubmit }: Props) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (data.error || !data.questions?.length) {
    return <p className="text-sm text-danger">{data.error ?? "No quiz available."}</p>;
  }

  const interactive = !!onSubmit;
  const answered = Object.keys(picked).length;
  const allAnswered = answered === data.questions.length;
  const score = Object.entries(picked).filter(
    ([i, opt]) => data.questions[Number(i)].answer_index === opt,
  ).length;
  const shareUrl =
    data.shareCode && typeof window !== "undefined"
      ? `${window.location.origin}/q/${data.shareCode}`
      : "";

  // In attempt mode results show only after submit; in preview mode per-question on pick.
  const showResult = (qi: number) => (interactive ? revealed : picked[qi] !== undefined);

  async function handleSubmit() {
    if (!onSubmit || !allAnswered) return;
    setSubmitting(true);
    try {
      await onSubmit(data.questions.map((_, qi) => picked[qi] ?? -1));
      setRevealed(true);
    } finally {
      setSubmitting(false);
    }
  }

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
            {!interactive && answered > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Score: {score}/{answered}
              </p>
            )}
          </div>
        </div>
      )}

      {data.questions.map((q, qi) => {
        const chosen = picked[qi];
        const reveal = showResult(qi);
        const locked = interactive ? revealed : chosen !== undefined;
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
                      !reveal && !isChosen && "border-border hover:bg-muted",
                      !reveal && isChosen && "border-primary/50 bg-primary/10",
                      reveal && isCorrect && "border-success/40 bg-success/10 text-success",
                      reveal && isChosen && !isCorrect && "border-danger/40 bg-danger/10 text-danger",
                      reveal && !isCorrect && !isChosen && "border-border opacity-60",
                    )}
                  >
                    <span>{opt}</span>
                    {reveal && isCorrect && <Check className="h-4 w-4 shrink-0" />}
                    {reveal && isChosen && !isCorrect && <X className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
            {reveal && q.explanation && (
              <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {interactive && !revealed && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-[transform,background-color] active:scale-[0.99] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : allAnswered ? "Submit answers" : `Answer all ${data.questions.length} questions`}
        </button>
      )}

      {interactive && revealed && (
        <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">You scored</p>
          <p className="font-display text-3xl font-semibold tracking-tight text-success">
            {score}/{data.questions.length}
          </p>
        </div>
      )}
    </div>
  );
}
