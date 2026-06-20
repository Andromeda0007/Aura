"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, FileQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Aurora } from "@/components/ui/aurora";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { quizApi, type QuizResults, type QuizSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

function ResultsPanel({ id }: { id: string }) {
  const [data, setData] = useState<QuizResults | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    quizApi.results(id).then(setData).catch(() => setError(true));
  }, [id]);

  if (error) return <p className="px-4 pb-4 text-sm text-danger">Could not load results.</p>;
  if (!data) return <p className="px-4 pb-4 text-sm text-muted-foreground">Loading results…</p>;

  if (data.attempts === 0) {
    return (
      <p className="px-4 pb-4 text-sm text-muted-foreground">
        No attempts yet. Share the code with students to collect responses.
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Attempts</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{data.attempts}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Avg score</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {data.avgScore}/{data.total}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Avg %</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {data.total ? Math.round((data.avgScore / data.total) * 100) : 0}%
          </p>
        </div>
      </div>

      {data.mostMissed.length > 0 && data.mostMissed[0].missRate > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Most missed
          </p>
          <div className="space-y-1.5">
            {data.mostMissed
              .filter((m) => m.missRate > 0)
              .map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-danger"
                      style={{ width: `${Math.round(m.missRate * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                    {Math.round(m.missRate * 100)}%
                  </span>
                  <span className="min-w-0 flex-[2] truncate">{m.question}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent attempts
        </p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {data.recent.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 tabular-nums font-medium">
                {r.score}/{r.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function QuizzesPage() {
  const ready = useRequireAuth();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    quizApi.list().then(setQuizzes).catch(() => toast.error("Could not load quizzes"));
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />

      <AppHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Quizzes</h2>
        <p className="mt-1 text-muted-foreground">
          Every quiz you&apos;ve generated, with how your students did.
        </p>

        <div className="mt-8 space-y-3">
          {quizzes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No quizzes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask Aura to make a quiz during a session — it&apos;ll show up here.
              </p>
            </div>
          ) : (
            quizzes.map((quiz) => {
              const isOpen = open === quiz.id;
              return (
                <div key={quiz.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : quiz.id)}
                    className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{quiz.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"} ·{" "}
                        <span className="font-mono">{quiz.shareCode}</span>
                        {quiz.createdAt &&
                          ` · ${formatDistanceToNow(new Date(quiz.createdAt), { addSuffix: true })}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
                      {quiz.attempts} attempt{quiz.attempts === 1 ? "" : "s"}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && <ResultsPanel id={quiz.id} />}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
