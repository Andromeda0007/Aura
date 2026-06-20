import Link from "next/link";
import { ArrowRight, Mic, PenLine, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";

const STEPS = [
  { icon: Mic, title: "Listens", body: "Live speech-to-text captures every explanation as you teach." },
  { icon: PenLine, title: "Watches", body: "Reads your whiteboard so Aura knows exactly what's on the board." },
  { icon: Sparkles, title: "Acts", body: "Say “Hey Aura” for quizzes, summaries, diagrams — the instant you ask." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">
            A
          </span>
          <span className="text-lg font-semibold tracking-tight">Aura</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Real-time, multi-modal teaching assistant
        </span>

        <h1 className="max-w-3xl text-balance font-display text-5xl font-semibold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-6xl">
          Teach. Aura handles the rest.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Aura listens to your lesson and reads your board, then turns it into quizzes,
          summaries, explanations, and diagrams — the instant you ask.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/signup"
            className="flex h-12 items-center justify-center rounded-full bg-primary px-8 font-medium text-primary-foreground transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            className="flex h-12 items-center justify-center rounded-full border border-border bg-card px-8 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Log in
          </Link>
        </div>

        {/* How it works — a real pipeline, not an icon-card grid */}
        <div className="mt-20 flex w-full max-w-4xl flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="flex flex-1 items-center gap-4 sm:flex-col sm:gap-3 sm:text-center">
              <div className="flex flex-1 items-start gap-4 sm:flex-col sm:items-center">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="text-left sm:text-center">
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 sm:block" />
              )}
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-sm text-muted-foreground">
        Built for the classroom smartboard.
      </footer>
    </div>
  );
}
