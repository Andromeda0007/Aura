"use client";

import { Check, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface Question {
  index: number;
  total: number;
  question: string;
  options: string[];
}
type Phase = "lobby" | "question" | "answered" | "reveal" | "ended";
interface LeaderRow {
  name: string;
  score: number;
}

const OPTION_COLORS = ["bg-rose-500", "bg-sky-500", "bg-amber-500", "bg-emerald-500"];

/** Renders nothing until a teacher starts a live quiz, then takes over the screen. */
export function LiveQuizStudent() {
  const [active, setActive] = useState(false);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [question, setQuestion] = useState<Question | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onStarted = () => {
      setActive(true);
      setPhase("lobby");
    };
    const onJoined = () => setJoined(true);
    const onQuestion = (q: Question) => {
      setQuestion(q);
      setChoice(null);
      setAnswerIndex(null);
      setPhase("question");
    };
    const onReveal = (d: { answerIndex: number; leaderboard: LeaderRow[] }) => {
      setAnswerIndex(d.answerIndex);
      setLeaderboard(d.leaderboard ?? []);
      setPhase("reveal");
    };
    const onEnd = (d: { leaderboard: LeaderRow[] }) => {
      setLeaderboard(d.leaderboard ?? []);
      setPhase("ended");
    };
    socket.on("livequiz_started", onStarted);
    socket.on("livequiz_joined", onJoined);
    socket.on("livequiz_question", onQuestion);
    socket.on("livequiz_reveal", onReveal);
    socket.on("livequiz_end", onEnd);
    return () => {
      socket.off("livequiz_started", onStarted);
      socket.off("livequiz_joined", onJoined);
      socket.off("livequiz_question", onQuestion);
      socket.off("livequiz_reveal", onReveal);
      socket.off("livequiz_end", onEnd);
    };
  }, []);

  if (!active) return null;

  function join() {
    getSocket()?.emit("livequiz_join", { name: name.trim() || "Player" });
  }

  function answer(i: number) {
    if (choice !== null) return;
    setChoice(i);
    setPhase("answered");
    getSocket()?.emit("livequiz_answer", { choice: i });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background p-6">
      {phase === "lobby" && !joined && (
        <div className="m-auto w-full max-w-sm text-center">
          <Trophy className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Live quiz!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a name to join the game.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="Your name"
            className="mt-5 h-12 w-full rounded-xl border border-input bg-background px-4 text-center text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={join}
            className="mt-3 h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground transition-transform active:scale-[0.99]"
          >
            Join
          </button>
        </div>
      )}

      {phase === "lobby" && joined && (
        <div className="m-auto text-center">
          <p className="font-display text-2xl font-semibold tracking-tight">You&apos;re in!</p>
          <p className="mt-1 text-muted-foreground">Waiting for the first question…</p>
        </div>
      )}

      {(phase === "question" || phase === "answered" || phase === "reveal") && question && (
        <div className="m-auto w-full max-w-lg">
          <p className="text-center text-sm text-muted-foreground">
            Question {question.index + 1} of {question.total}
          </p>
          <h2 className="mt-2 text-center font-display text-2xl font-semibold tracking-tight">
            {question.question}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {question.options.map((opt, oi) => {
              const isAnswer = phase === "reveal" && oi === answerIndex;
              const isChoice = oi === choice;
              const dim =
                (phase === "answered" && !isChoice) || (phase === "reveal" && !isAnswer && !isChoice);
              return (
                <button
                  key={oi}
                  type="button"
                  disabled={choice !== null}
                  onClick={() => answer(oi)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-4 py-5 text-left text-lg font-medium text-white transition-[transform,opacity] active:scale-[0.98]",
                    OPTION_COLORS[oi % OPTION_COLORS.length],
                    dim && "opacity-40",
                    phase === "reveal" && isAnswer && "ring-4 ring-white",
                  )}
                >
                  <span>{opt}</span>
                  {phase === "reveal" && isAnswer && <Check className="h-5 w-5" />}
                  {isChoice && phase !== "reveal" && <Check className="h-5 w-5" />}
                </button>
              );
            })}
          </div>
          {phase === "answered" && (
            <p className="mt-5 text-center text-muted-foreground">Locked in — waiting for others…</p>
          )}
          {phase === "reveal" && (
            <p className="mt-5 text-center font-medium">
              {choice === answerIndex ? "Correct! 🎉" : "Not this time."}
            </p>
          )}
        </div>
      )}

      {phase === "ended" && (
        <div className="m-auto w-full max-w-sm text-center">
          <Trophy className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">Final results</h2>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border text-left">
            {leaderboard.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold",
                    i === 0 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{r.name}</span>
                <span className="tabular-nums font-semibold">{r.score}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActive(false)}
            className="mt-6 text-sm text-muted-foreground hover:underline"
          >
            Back to the board
          </button>
        </div>
      )}
    </div>
  );
}
