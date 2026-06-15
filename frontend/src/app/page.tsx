import Link from "next/link";
import { Mic, PenLine, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";

const FEATURES = [
  { icon: Mic, title: "Listens", body: "Live speech-to-text captures every explanation as you teach." },
  { icon: PenLine, title: "Watches", body: "Reads your whiteboard so the AI knows exactly what's on the board." },
  { icon: Sparkles, title: "Acts", body: "Say “Hey Aura” to generate quizzes, summaries, diagrams, and more." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
            A
          </span>
          <span className="text-lg font-semibold tracking-tight">Aura</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent" />
          Real-time multi-modal teaching assistant
        </span>
        <h1 className="max-w-3xl bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-4xl font-bold leading-tight tracking-tight text-transparent sm:text-6xl">
          Teach. Aura handles the rest.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Aura listens to your lesson and reads your board, then turns it into quizzes,
          summaries, explanations, and diagrams — the instant you ask.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/signup"
            className="flex h-12 items-center justify-center rounded-full bg-primary px-8 font-medium text-primary-foreground transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 text-left">
              <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-muted text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
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
