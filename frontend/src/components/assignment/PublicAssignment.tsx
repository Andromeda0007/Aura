"use client";

import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { QuizDisplay } from "@/components/ai-panel/QuizDisplay";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Status = "loading" | "ok" | "error";
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Data {
  title: string;
  instructions: string;
  dueAt: string | null;
  quizData: { questions: unknown[] } | null;
}

export function PublicAssignment({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<Data | null>(null);
  const [name, setName] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/assignments/code/${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j) => {
        setData(j);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [code]);

  async function submit(answers: number[]) {
    await fetch(`${BASE}/assignments/code/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_name: name.trim() || null, answers }),
    });
    setDone(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            A
          </span>
          <span className="font-semibold">Aura Homework</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
        {status === "error" && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-medium">Assignment not found</p>
            <p className="mt-1 text-sm text-muted-foreground">This link is invalid or expired.</p>
          </div>
        )}

        {status === "ok" && data && (
          <>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{data.title}</h1>
            {data.dueAt && (
              <p className="mt-1 text-sm text-muted-foreground">
                Due {format(new Date(data.dueAt), "EEE, MMM d 'at' h:mm a")}
              </p>
            )}
            {data.instructions && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{data.instructions}</p>
            )}

            {done ? (
              <div className="mt-8 rounded-2xl border border-success/40 bg-success/10 p-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                <p className="mt-3 font-medium">Submitted!</p>
                <p className="mt-1 text-sm text-muted-foreground">Your teacher can see your work.</p>
              </div>
            ) : data.quizData ? (
              !started ? (
                <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
                  <p className="text-sm text-muted-foreground">Add your name, then start.</p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                  >
                    Start
                  </button>
                </div>
              ) : (
                <div className="mt-8">
                  <QuizDisplay data={data.quizData as never} onSubmit={submit} />
                </div>
              )
            ) : (
              <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-6">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => submit([])}
                  className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                >
                  Mark as done
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
