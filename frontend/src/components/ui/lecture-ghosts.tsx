import { Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

// Faint "live lecture" cards scattered as a background (e.g. behind the login
// form), mirroring the landing-page mocks. Background only: low z + dim, so the
// form on top cleanly covers them.
interface Mock {
  subject: string;
  kind: string;
  board: React.ReactNode;
  output: React.ReactNode;
}

function GhostCard({ data, className }: { data: Mock; className?: string }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">{data.subject} · live</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-danger">
          <span className="h-2 w-2 rounded-full bg-danger" /> REC
        </span>
      </div>
      <div className="grid flex-1 grid-cols-5">
        <div className="col-span-3 space-y-3 border-r border-border bg-muted/40 p-5">{data.board}</div>
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

const PHOTO: Mock = {
  subject: "Photosynthesis",
  kind: "Quiz",
  board: (
    <>
      <p className="font-display text-lg">Light reactions</p>
      <div className="h-px w-2/3 bg-border" />
      <p className="text-sm text-muted-foreground">6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</p>
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
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
        Share code <span className="font-mono font-semibold text-foreground">8FQ2K</span>
      </div>
    </>
  ),
};

const DATA_STRUCTURES: Mock = {
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
      </div>
    </>
  ),
};

const VENN: Mock = {
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

/** `login` = a 3-card deck framing the form; `page` = just 1–2 faint cards
 *  peeking from the edges, for content pages (kept minimal on purpose). */
export function LectureGhosts({ variant = "page" }: { variant?: "page" | "login" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden lg:block">
      {variant === "login" ? (
        // one ghost card up where the "E = mc²" doodle sits
        <GhostCard data={PHOTO} className="absolute left-[34%] top-[9%] w-80 -rotate-3 opacity-[0.13] blur-[1px]" />
      ) : (
        <>
          <GhostCard data={DATA_STRUCTURES} className="absolute -right-12 top-[16%] w-72 rotate-6 opacity-[0.1] blur-[1px]" />
          <GhostCard data={VENN} className="absolute left-[56%] top-[56%] w-64 -translate-x-1/2 rotate-3 opacity-[0.1] blur-[1px]" />
        </>
      )}
    </div>
  );
}
