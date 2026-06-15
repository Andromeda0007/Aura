"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { QuizDisplay } from "@/components/ai-panel/QuizDisplay";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Status = "loading" | "ok" | "error";

export function PublicQuiz({ shareCode }: { shareCode: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [quiz, setQuiz] = useState<{ questions: unknown[] } | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${base}/quizzes/${shareCode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((j) => {
        setQuiz(j.quiz_data);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [shareCode]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            A
          </span>
          <span className="font-semibold">Aura Quiz</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading quiz…</p>}
        {status === "error" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-medium">Quiz not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This share code is invalid or has expired.
            </p>
          </div>
        )}
        {status === "ok" && quiz && (
          <>
            <h1 className="mb-4 text-2xl font-semibold tracking-tight">Take the quiz</h1>
            <QuizDisplay data={quiz as never} />
          </>
        )}
      </main>
    </div>
  );
}
