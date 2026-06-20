"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { QuizDisplay } from "@/components/ai-panel/QuizDisplay";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Status = "loading" | "ok" | "error";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function PublicQuiz({ shareCode }: { shareCode: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [quiz, setQuiz] = useState<{ questions: unknown[] } | null>(null);
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/quizzes/${shareCode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((j) => {
        setQuiz(j.quiz_data);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [shareCode]);

  async function submit(answers: number[]) {
    await fetch(`${BASE}/quizzes/${shareCode}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_name: name.trim() || null, answers }),
    });
  }

  const count = quiz?.questions?.length ?? 0;

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
        {status === "ok" && quiz && !started && (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Ready to start?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {count} question{count === 1 ? "" : "s"} · add your name so your teacher can see your score.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (optional)"
              className="mt-5 h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-transform active:scale-[0.99]"
            >
              Start quiz
            </button>
          </div>
        )}
        {status === "ok" && quiz && started && (
          <>
            <h1 className="mb-4 font-display text-2xl font-semibold tracking-tight">
              {name.trim() ? `Good luck, ${name.trim()}!` : "Take the quiz"}
            </h1>
            <QuizDisplay data={quiz as never} onSubmit={submit} />
          </>
        )}
      </main>
    </div>
  );
}
