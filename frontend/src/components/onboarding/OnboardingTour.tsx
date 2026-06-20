"use client";

import { ClipboardList, Mic, PencilRuler, Radio, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "aura_onboarded_v1";

const STEPS = [
  {
    icon: PencilRuler,
    title: "Start a session",
    body: "Name a topic and open the board. Everything you teach is captured for quizzes, summaries, and recaps.",
  },
  {
    icon: Radio,
    title: "Hit Record",
    body: "Recording turns on live transcription and watches your board, so Aura always has context.",
  },
  {
    icon: Mic,
    title: 'Say "Hey Aura" or tap the mic',
    body: "Ask for a quiz, summary, diagram, or explanation out loud — or type it in the command box.",
  },
  {
    icon: Users,
    title: "Bring students in",
    body: "Invite students to follow your board live, or run a Kahoot-style live quiz on their phones.",
  },
  {
    icon: ClipboardList,
    title: "Assign homework",
    body: "Turn any quiz into homework with a due date, and track who's completed it.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(KEY)) setOpen(true);
  }, []);

  function close() {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-70 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <button
          type="button"
          onClick={close}
          aria-label="Skip"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <s.icon className="h-6 w-6" />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{s.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>

        <div className="mt-5 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={close} className="text-sm text-muted-foreground hover:underline">
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((v) => v - 1)}
                className="rounded-xl border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? close() : setStep((v) => v + 1))}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
            >
              {last ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
