import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Aurora } from "@/components/ui/aurora";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <Aurora />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground">
            A
          </span>
          <span className="text-lg font-semibold tracking-tight">Aura</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/auth/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 pb-20 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* Left — editorial hero */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live, multi-modal teaching assistant
          </span>

          <h1 className="mt-6 text-balance font-display text-6xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
            Just teach.
            <br />
            <span className="text-primary">Aura</span> does the
            <br />
            paperwork.
          </h1>

          <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            It listens to your lesson and reads your board, then turns the moment you
            just taught into a quiz, a summary, or a diagram — out loud, on command.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/login"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-medium text-primary-foreground transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Log in
              <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
            </Link>
            <span className="text-sm text-muted-foreground">Works on any smartboard</span>
          </div>

          <div className="mt-12 flex items-center gap-6 text-sm text-muted-foreground">
            {["Listens", "Watches", "Acts"].map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                <span className="font-medium text-foreground">{s}</span>
                {i < 2 && <span className="text-muted-foreground/40">·</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Right — product preview (shows what Aura actually is) */}
        <ProductPreview />
      </main>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="relative lg:rotate-[1.2deg]">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
        {/* window bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
          <span className="ml-2 text-xs font-medium text-muted-foreground">Photosynthesis · live</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> REC
          </span>
        </div>

        <div className="grid grid-cols-5">
          {/* faux board */}
          <div className="col-span-3 space-y-3 border-r border-border bg-muted/40 p-5">
            <p className="font-display text-lg">Light reactions</p>
            <div className="h-px w-2/3 bg-border" />
            <p className="text-sm text-muted-foreground">6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</p>
            <div className="mt-2 flex gap-2">
              <span className="h-16 w-16 rounded-lg border-2 border-accent/50" />
              <span className="mt-6 text-xs text-muted-foreground">chlorophyll →</span>
            </div>
            <p className="text-xs text-muted-foreground/70">“…so the thylakoid absorbs the light here…”</p>
          </div>

          {/* Aura result card */}
          <div className="col-span-2 space-y-3 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-accent/15">
                <Sparkles className="h-3 w-3" />
              </span>{" "}
              Quiz
            </div>
            <p className="text-sm font-medium leading-snug">Where do the light reactions occur?</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-success">
                Thylakoid <Check className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground">Stroma</div>
              <div className="rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground">Nucleus</div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
              Share code <span className="font-mono font-semibold text-foreground">8FQ2K</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
