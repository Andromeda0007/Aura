"use client";

import { Check, Trophy, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { quizApi, type QuizSummary } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface Question {
  question: string;
  options: string[];
  answer_index: number;
}
type Phase = "pick" | "lobby" | "question" | "reveal" | "ended";
interface LeaderRow {
  name: string;
  score: number;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const OPTION_COLORS = ["bg-rose-500", "bg-sky-500", "bg-amber-500", "bg-emerald-500"];

export function LiveQuizHost({ onClose }: { onClose: () => void }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subject, setSubject] = useState("");
  const [phase, setPhase] = useState<Phase>("pick");
  const [index, setIndex] = useState(-1);
  const [players, setPlayers] = useState(0);
  const [answers, setAnswers] = useState(0);
  const [tally, setTally] = useState<number[]>([]);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  useEffect(() => {
    quizApi.list().then(setQuizzes).catch(() => toast.error("Could not load quizzes"));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onStarted = (d: { total: number; subject: string }) => {
      setPhase("lobby");
      setSubject(d.subject);
    };
    const onPlayers = (d: { count: number }) => setPlayers(d.count);
    const onTally = (d: { count: number }) => setAnswers(d.count);
    const onReveal = (d: { answerIndex: number; tally: number[]; leaderboard: LeaderRow[] }) => {
      setAnswerIndex(d.answerIndex);
      setTally(d.tally ?? []);
      setLeaderboard(d.leaderboard ?? []);
      setPhase("reveal");
    };
    const onEnd = (d: { leaderboard: LeaderRow[] }) => {
      setLeaderboard(d.leaderboard ?? []);
      setPhase("ended");
    };
    socket.on("livequiz_started", onStarted);
    socket.on("livequiz_players", onPlayers);
    socket.on("livequiz_tally", onTally);
    socket.on("livequiz_reveal", onReveal);
    socket.on("livequiz_end", onEnd);
    return () => {
      socket.off("livequiz_started", onStarted);
      socket.off("livequiz_players", onPlayers);
      socket.off("livequiz_tally", onTally);
      socket.off("livequiz_reveal", onReveal);
      socket.off("livequiz_end", onEnd);
    };
  }, []);

  async function start(quiz: QuizSummary) {
    try {
      const res = await fetch(`${BASE}/quizzes/${quiz.shareCode}`).then((r) => r.json());
      setQuestions(res.quiz_data?.questions ?? []);
      setSubject(quiz.subject);
      getSocket()?.emit("livequiz_start", { quizId: quiz.id });
      setPhase("lobby");
    } catch {
      toast.error("Could not start live quiz");
    }
  }

  function showQuestion(i: number) {
    setIndex(i);
    setAnswers(0);
    setAnswerIndex(null);
    setTally([]);
    getSocket()?.emit("livequiz_question", { index: i });
    setPhase("question");
  }

  function reveal() {
    getSocket()?.emit("livequiz_reveal", {});
  }

  function end() {
    getSocket()?.emit("livequiz_end", {});
  }

  const current = questions[index];
  const isLast = index >= questions.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold">Live quiz{subject ? ` · ${subject}` : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          {phase !== "pick" && (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
              <Users className="h-4 w-4" /> {players} joined
            </span>
          )}
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-8">
        {phase === "pick" && (
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Pick a quiz to host</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Students who joined your class can play on their phones.
            </p>
            <div className="mt-6 space-y-2">
              {quizzes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No quizzes yet — ask Aura to make one during the session.
                </p>
              ) : (
                quizzes.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => start(q)}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <span className="font-medium">{q.subject}</span>
                    <span className="text-xs text-muted-foreground">{q.questionCount} questions</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {phase === "lobby" && (
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Lobby open</h2>
            <p className="mt-2 text-muted-foreground">
              {players} player{players === 1 ? "" : "s"} joined. Start when ready.
            </p>
            <Button className="mt-8" size="lg" onClick={() => showQuestion(0)}>
              Start question 1
            </Button>
          </div>
        )}

        {(phase === "question" || phase === "reveal") && current && (
          <div>
            <p className="text-sm text-muted-foreground">
              Question {index + 1} of {questions.length}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {current.question}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {current.options.map((opt, oi) => {
                const isAnswer = phase === "reveal" && oi === answerIndex;
                const count = tally[oi] ?? 0;
                const maxCount = Math.max(1, ...tally);
                return (
                  <div
                    key={oi}
                    className={cn(
                      "relative overflow-hidden rounded-xl border px-4 py-4 text-white",
                      OPTION_COLORS[oi % OPTION_COLORS.length],
                      phase === "reveal" && !isAnswer && "opacity-50",
                    )}
                  >
                    {phase === "reveal" && (
                      <div
                        className="absolute inset-y-0 left-0 bg-black/20"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between gap-2">
                      <span className="font-medium">{opt}</span>
                      <span className="flex items-center gap-2">
                        {phase === "reveal" && <span className="tabular-nums">{count}</span>}
                        {isAnswer && <Check className="h-5 w-5" />}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{answers} answered</span>
              {phase === "question" ? (
                <Button onClick={reveal}>Reveal answer</Button>
              ) : isLast ? (
                <Button onClick={end}>Finish &amp; show winners</Button>
              ) : (
                <Button onClick={() => showQuestion(index + 1)}>Next question</Button>
              )}
            </div>

            {phase === "reveal" && leaderboard.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Leaderboard
                </p>
                <Leaderboard rows={leaderboard} />
              </div>
            )}
          </div>
        )}

        {phase === "ended" && (
          <div className="text-center">
            <Trophy className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Final results</h2>
            <div className="mx-auto mt-6 max-w-md text-left">
              <Leaderboard rows={leaderboard} />
            </div>
            <Button className="mt-8" variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
              i === 0 && "bg-amber-400 text-black",
              i === 1 && "bg-zinc-300 text-black",
              i === 2 && "bg-orange-400 text-black",
              i > 2 && "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className="flex-1 truncate font-medium">{r.name}</span>
          <span className="tabular-nums font-semibold">{r.score}</span>
        </div>
      ))}
    </div>
  );
}
