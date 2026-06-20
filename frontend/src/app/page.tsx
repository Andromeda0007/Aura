import Link from "next/link";
import { ArrowRight, Check, Layers, Library, Radio, Sparkles, Users } from "lucide-react";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Aurora } from "@/components/ui/aurora";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <Aurora />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
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

      <main className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 pb-16 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* Left — editorial hero */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live, multi-modal teaching assistant
          </span>

          <h1 className="mt-6 text-balance font-display text-6xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
            Just teach.
            <br />
            Let <span className="text-primary">Aura</span> handle
            <br />
            the rest.
          </h1>

          <p className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground">
            It listens to your lesson and reads your board, then turns the moment you just taught into
            a quiz, a summary, or a diagram — out loud, on command. And it runs the whole class around
            it: your batches, departments, courses and people, with a library of everything you make.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/login"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-medium text-primary-foreground transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Log in
              <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" />
            </Link>
            <span className="text-sm text-muted-foreground">Works on any smartboard · English · हिंदी · मराठी</span>
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

        {/* Right — a deck of live-lecture cards; the subject "ghosts" sit behind as doodles */}
        <div className="relative">
          <LectureCard
            data={PHOTOSYNTHESIS}
            className="absolute -left-14 -top-9 hidden w-[82%] -rotate-6 opacity-[0.15] blur-[1px] lg:block"
          />
          <LectureCard
            data={VENN}
            className="absolute -right-14 -top-6 hidden w-[72%] rotate-[10deg] opacity-[0.14] blur-[1px] lg:block"
          />
          <LectureCard
            data={TREE_DIAGRAM}
            className="absolute -bottom-12 -left-10 hidden w-[74%] -rotate-[10deg] opacity-[0.13] blur-[1px] lg:block"
          />
          <LectureCard data={DATA_STRUCTURES} className="relative z-10 shadow-2xl shadow-primary/10 lg:rotate-[1.2deg]" />
        </div>
      </main>

      {/* What a single lesson can become */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-14">
        <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          One lesson, every format.
        </h2>
        <p className="mt-2 max-w-md text-pretty text-muted-foreground">
          Ask out loud and Aura reshapes what you just taught — a fillable numerical, a real chemical
          structure, a diagram, a summary.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <LectureCard data={CALCULUS} className="shadow-xl shadow-primary/5" />
          <LectureCard data={CHEMISTRY} className="shadow-xl shadow-primary/5" />
          <LectureCard data={BLOCKCHAIN} className="shadow-xl shadow-primary/5" />
          <WhiteboardCard className="shadow-xl shadow-primary/5" />
        </div>
      </section>

      {/* The platform around the board */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Not just a board — the whole class.
        </h2>
        <p className="mt-2 max-w-lg text-pretty text-muted-foreground">
          Aura grew from a smart whiteboard into the system that runs the classroom around it.
        </p>
        <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const FEATURES = [
  {
    Icon: Radio,
    title: "Live on the board",
    body: "Your voice and whiteboard become quizzes, diagrams and summaries — on command.",
  },
  {
    Icon: Layers,
    title: "Your whole school",
    body: "Batches, departments, semesters, courses and units, organised in one place.",
  },
  {
    Icon: Users,
    title: "Roles done right",
    body: "Admins, teachers and students each see exactly the classes that are theirs.",
  },
  {
    Icon: Library,
    title: "Nothing lost",
    body: "Every quiz, summary and diagram is saved to the class library.",
  },
];

interface LectureMock {
  subject: string;
  kind: string;
  board: React.ReactNode;
  output: React.ReactNode;
}

function LectureCard({ data, className }: { data: LectureMock; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">{data.subject} · live</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-danger">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> REC
        </span>
      </div>

      <div className="grid grid-cols-5">
        {/* faux board */}
        <div className="col-span-3 space-y-3 border-r border-border bg-muted/40 p-5">{data.board}</div>
        {/* Aura result card */}
        <div className="col-span-2 space-y-3 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-accent/15">
              <Sparkles className="h-3 w-3" />
            </span>{" "}
            {data.kind}
          </div>
          {data.output}
        </div>
      </div>
    </div>
  );
}

/** The actual whiteboard with the teacher's ink + two dragged-on Aura cards. */
function WhiteboardCard({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">Whiteboard · drag &amp; drop</span>
      </div>
      <div className="relative h-60 overflow-hidden bg-muted/30">
        {/* graph paper */}
        <svg aria-hidden className="absolute inset-0 h-full w-full text-foreground/6">
          <defs>
            <pattern id="wb-grid" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M22 0 H0 V22" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wb-grid)" />
        </svg>

        {/* teacher's ink */}
        <svg
          className="absolute left-4 top-6 h-16 w-24 text-foreground/40"
          viewBox="0 0 100 70"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M10 4 V64 H92" />
          <path d="M14 60 Q52 -6 88 60" />
        </svg>
        <span className="absolute bottom-7 left-6 font-display text-sm italic text-foreground/40 -rotate-3">
          y = x²
        </span>

        {/* dragged-on quiz */}
        <div className="absolute right-3 top-5 w-36 rotate-3 rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-accent">
            <Sparkles className="h-3 w-3" /> Quiz
          </div>
          <p className="mt-1 text-[11px] font-medium leading-snug">Where do light reactions occur?</p>
          <div className="mt-1 rounded border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
            Thylakoid ✓
          </div>
        </div>

        {/* dragged-on diagram */}
        <div className="absolute bottom-4 right-7 w-24 -rotate-3 rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-accent">
            <Sparkles className="h-3 w-3" /> Diagram
          </div>
          <div className="grid place-items-center py-0.5">
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={2} className="h-9 w-9 text-foreground">
              <polygon points="20,4 34,12 34,28 20,36 6,28 6,12" />
              <circle cx="20" cy="20" r="7" strokeDasharray="2 3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

const PHOTOSYNTHESIS: LectureMock = {
  subject: "Photosynthesis",
  kind: "Quiz",
  board: (
    <>
      <p className="font-display text-lg">Light reactions</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</p>
      <div className="mt-2 flex gap-2">
        <span className="h-16 w-16 rounded-lg border-2 border-accent/50" />
        <span className="mt-6 text-xs text-muted-foreground">chlorophyll →</span>
      </div>
      <p className="text-xs text-muted-foreground/70">“…so the thylakoid absorbs the light here…”</p>
    </>
  ),
  output: (
    <>
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
    </>
  ),
};

const DATA_STRUCTURES: LectureMock = {
  subject: "Data Structures",
  kind: "Quiz",
  board: (
    <>
      <p className="font-display text-lg">Binary Search Tree</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">insert 8, 3, 10, 1, 6</p>
      <pre className="mt-1 whitespace-pre font-mono text-[11px] leading-4 text-muted-foreground">{`    8
   / \\
  3   10
 / \\
1   6`}</pre>
      <p className="text-xs text-muted-foreground/70">“…the left child always stays smaller…”</p>
    </>
  ),
  output: (
    <>
      <p className="text-sm font-medium leading-snug">Inorder traversal of this tree?</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-success">
          1 · 3 · 6 · 8 · 10 <Check className="h-3.5 w-3.5" />
        </div>
        <div className="rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground">8 · 3 · 10 · 1 · 6</div>
        <div className="rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground">1 · 3 · 8 · 6 · 10</div>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
        Share code <span className="font-mono font-semibold text-foreground">B3T7X</span>
      </div>
    </>
  ),
};

const BLOCKCHAIN: LectureMock = {
  subject: "Blockchain",
  kind: "Summary",
  board: (
    <>
      <p className="font-display text-lg">Blocks &amp; hashes</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">block: hash · prev · nonce</p>
      <p className="text-xs text-muted-foreground/70">“…each block links the previous hash…”</p>
    </>
  ),
  output: (
    <>
      <p className="text-sm font-medium leading-snug">In one line</p>
      <p className="text-xs text-muted-foreground">
        A tamper-evident chain — every block stores the previous block’s hash.
      </p>
    </>
  ),
};

const CALCULUS: LectureMock = {
  subject: "Calculus",
  kind: "Numerical",
  board: (
    <>
      <p className="font-display text-lg">Definite integrals</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">∫₀² 3x² dx</p>
      <p className="text-xs text-muted-foreground/70">“…the area under the curve from 0 to 2…”</p>
    </>
  ),
  output: (
    <>
      <p className="text-sm font-medium leading-snug">Evaluate ∫₀² 3x² dx</p>
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-lg border border-input px-2.5 py-1.5 text-xs text-foreground">8</span>
        <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Check</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 py-1.5 text-xs text-success">
        <Check className="h-3.5 w-3.5" /> Correct — x³ from 0 to 2 = 8
      </div>
    </>
  ),
};

const CHEMISTRY: LectureMock = {
  subject: "Organic Chemistry",
  kind: "Structure",
  board: (
    <>
      <p className="font-display text-lg">Aromatic rings</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">“draw benzene”</p>
      <p className="text-xs text-muted-foreground/70">“…six carbons, alternating bonds…”</p>
    </>
  ),
  output: (
    <>
      <p className="text-sm font-medium leading-snug">Benzene · C₆H₆</p>
      <div className="grid place-items-center py-1">
        <svg viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth={2} className="h-16 w-16 text-foreground">
          <polygon points="30,5 52,17.5 52,42.5 30,55 8,42.5 8,17.5" />
          <circle cx="30" cy="30" r="11" strokeDasharray="2 3" />
        </svg>
      </div>
      <p className="text-[11px] text-muted-foreground">from PubChem · CID 241</p>
    </>
  ),
};

const VENN: LectureMock = {
  subject: "Set Theory",
  kind: "Explanation",
  board: (
    <>
      <p className="font-display text-lg">Unions &amp; intersections</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">A ∩ B vs A ∪ B</p>
      <p className="text-xs text-muted-foreground/70">“…the overlap is what they share…”</p>
    </>
  ),
  output: (
    <>
      <p className="text-sm font-medium leading-snug">A ∩ B is the overlap</p>
      <div className="grid place-items-center py-1">
        <svg viewBox="0 0 96 56" fill="none" stroke="currentColor" strokeWidth={2} className="h-14 w-24 text-foreground">
          <circle cx="38" cy="28" r="22" />
          <circle cx="58" cy="28" r="22" />
        </svg>
      </div>
      <p className="text-[11px] text-muted-foreground">elements in both sets</p>
    </>
  ),
};

const TREE_DIAGRAM: LectureMock = {
  subject: "Decision Trees",
  kind: "Diagram",
  board: (
    <>
      <p className="font-display text-lg">Decision tree</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">split on a feature → leaf</p>
      <p className="text-xs text-muted-foreground/70">“…each branch tests one feature…”</p>
    </>
  ),
  output: (
    <>
      <p className="text-sm font-medium leading-snug">Generated diagram</p>
      <div className="grid place-items-center py-1">
        <svg viewBox="0 0 100 70" fill="none" stroke="currentColor" strokeWidth={2} className="h-16 w-24 text-foreground">
          <line x1="50" y1="12" x2="26" y2="40" />
          <line x1="50" y1="12" x2="74" y2="40" />
          <line x1="26" y1="40" x2="14" y2="62" />
          <line x1="26" y1="40" x2="38" y2="62" />
          <circle cx="50" cy="12" r="6" />
          <circle cx="26" cy="40" r="6" />
          <circle cx="74" cy="40" r="6" />
          <circle cx="14" cy="62" r="6" />
          <circle cx="38" cy="62" r="6" />
        </svg>
      </div>
    </>
  ),
};
