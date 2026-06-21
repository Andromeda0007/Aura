import {
  Atom,
  Binary,
  Brain,
  Dna,
  FlaskConical,
  Globe,
  Landmark,
  Network,
  Orbit,
  Rocket,
  Scale,
  Telescope,
} from "lucide-react";

import { cn } from "@/lib/utils";

// A faint, scattered "chalkboard scribble" backdrop: subject icons + real math/
// science snippets + little hand-sketched graphs, trees and a wave. Background
// only — very dim + low z, so any solid surface on top cleanly "cuts" them.
// Positions are a fixed set (deterministic — no hydration mismatch).

const ICONS: { Icon: typeof Atom; c: string }[] = [
  { Icon: Atom, c: "left-[30%] top-[7%] h-16 w-16 rotate-12" },
  { Icon: Dna, c: "right-[33%] bottom-[9%] h-14 w-14 -rotate-6" },
  { Icon: Rocket, c: "right-[7%] top-[12%] h-12 w-12 rotate-12" },
  { Icon: FlaskConical, c: "left-[12%] bottom-[12%] h-12 w-12 rotate-6" },
  { Icon: Network, c: "right-[5%] bottom-[24%] h-14 w-14 -rotate-12" },
  { Icon: Scale, c: "left-[20%] top-[44%] h-12 w-12 rotate-6" },
  { Icon: Orbit, c: "right-[26%] bottom-[34%] h-14 w-14 rotate-6" },
  { Icon: Brain, c: "left-[25%] bottom-[27%] h-12 w-12 rotate-6" },
  { Icon: Binary, c: "right-[20%] top-[40%] h-12 w-12 -rotate-6" },
  { Icon: Globe, c: "right-[43%] top-[16%] h-12 w-12 -rotate-6" },
  { Icon: Telescope, c: "left-[6%] bottom-[40%] h-12 w-12 rotate-6" },
  { Icon: Landmark, c: "left-[62%] bottom-[8%] h-12 w-12 rotate-3" },
];

// Math / science / CS snippets. font-display (serif) reads like chalkboard math;
// font-mono for number & binary scatters.
const TEXTS: { t: string; c: string }[] = [
  { t: "∫ x² dx = ⅓x³", c: "left-[7%] top-[22%] font-display italic text-base -rotate-6" },
  { t: "d/dx eˣ = eˣ", c: "right-[10%] top-[30%] font-display italic text-sm rotate-6" },
  { t: "∑ 1/n² = π²/6", c: "left-[27%] bottom-[19%] font-display italic text-base rotate-3" },
  { t: "a² + b² = c²", c: "right-[29%] top-[10%] font-display italic text-lg -rotate-12" },
  { t: "E = mc²", c: "left-[41%] top-[13%] font-display italic text-lg rotate-6" },
  { t: "lim Δx→0", c: "right-[6%] bottom-[36%] font-display italic text-sm rotate-3" },
  { t: "O(n log n)", c: "left-[14%] top-[60%] font-mono text-sm -rotate-6" },
  { t: "∇·E = ρ/ε₀", c: "right-[36%] bottom-[14%] font-display italic text-base rotate-6" },
  { t: "(−b ± √(b²−4ac))/2a", c: "left-[33%] bottom-[7%] font-display italic text-sm -rotate-3" },
  { t: "C₆H₁₂O₆", c: "right-[13%] top-[54%] font-display italic text-base rotate-6" },
  { t: "∂f/∂x", c: "left-[3%] bottom-[24%] font-display italic text-xl rotate-12" },
  { t: "f′(x)", c: "right-[48%] top-[44%] font-display italic text-lg -rotate-6" },
  { t: "θ = tan⁻¹(y/x)", c: "left-[58%] bottom-[30%] font-display italic text-sm rotate-3" },
  { t: "πr²", c: "left-[50%] top-[6%] font-display italic text-4xl -rotate-3" },
  { t: "8  3  10  1  6", c: "right-[44%] top-[38%] font-mono text-sm rotate-3" },
  { t: "0110 1011 0010", c: "right-[15%] bottom-[15%] font-mono text-sm -rotate-3" },
  { t: "2 3 5 7 11 13", c: "right-[22%] bottom-[9%] font-mono text-sm rotate-6" },
  { t: "√2 ≈ 1.41421", c: "left-[44%] bottom-[40%] font-mono text-sm -rotate-3" },
];

const svgBase = "absolute text-foreground/6";

/** The raw scattered scribbles (no wrapper) — embedded inside Aurora's background div. */
export function DoodleIcons() {
  return (
    <>
      {ICONS.map(({ Icon, c }, i) => (
        <Icon key={`i${i}`} strokeWidth={1.25} className={cn("absolute text-foreground/4.5", c)} />
      ))}
      {TEXTS.map(({ t, c }, i) => (
        <span key={`t${i}`} className={cn("absolute whitespace-nowrap text-foreground/6", c)}>
          {t}
        </span>
      ))}

      {/* parabola on axes */}
      <svg viewBox="0 0 110 80" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
        className={cn(svgBase, "left-[17%] top-[9%] h-20 w-28 rotate-3")}>
        <path d="M12 6 V72 H104" />
        <path d="M16 70 Q58 -8 100 70" />
      </svg>

      {/* binary tree sketch */}
      <svg viewBox="0 0 100 86" fill="none" stroke="currentColor" strokeWidth={2}
        className={cn(svgBase, "right-[16%] top-[36%] h-20 w-24 -rotate-3")}>
        <line x1="50" y1="16" x2="28" y2="46" />
        <line x1="50" y1="16" x2="72" y2="46" />
        <line x1="28" y1="46" x2="16" y2="74" />
        <line x1="28" y1="46" x2="40" y2="74" />
        <line x1="72" y1="46" x2="84" y2="74" />
        <circle cx="50" cy="14" r="7" />
        <circle cx="28" cy="46" r="7" />
        <circle cx="72" cy="46" r="7" />
        <circle cx="16" cy="76" r="7" />
        <circle cx="40" cy="76" r="7" />
        <circle cx="84" cy="76" r="7" />
      </svg>

      {/* sine wave */}
      <svg viewBox="0 0 120 40" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
        className={cn(svgBase, "left-[63%] top-[24%] h-12 w-32 rotate-6")}>
        <path d="M4 20 Q19 0 34 20 T64 20 T94 20 T118 20" />
      </svg>

      {/* second binary tree sketch (replaces the binary-digit scatter) */}
      <svg viewBox="0 0 100 86" fill="none" stroke="currentColor" strokeWidth={2}
        className={cn(svgBase, "left-[53%] top-[30%] h-16 w-20 -rotate-6")}>
        <line x1="50" y1="16" x2="28" y2="46" />
        <line x1="50" y1="16" x2="72" y2="46" />
        <line x1="28" y1="46" x2="16" y2="74" />
        <line x1="28" y1="46" x2="40" y2="74" />
        <circle cx="50" cy="14" r="7" />
        <circle cx="28" cy="46" r="7" />
        <circle cx="72" cy="46" r="7" />
        <circle cx="16" cy="76" r="7" />
        <circle cx="40" cy="76" r="7" />
      </svg>

      {/* node graph */}
      <svg viewBox="0 0 90 80" fill="none" stroke="currentColor" strokeWidth={2}
        className={cn(svgBase, "left-[2%] top-[58%] h-16 w-20 rotate-6")}>
        <line x1="18" y1="20" x2="64" y2="14" />
        <line x1="18" y1="20" x2="40" y2="56" />
        <line x1="64" y1="14" x2="74" y2="52" />
        <line x1="40" y1="56" x2="74" y2="52" />
        <circle cx="18" cy="20" r="6" />
        <circle cx="64" cy="14" r="6" />
        <circle cx="40" cy="56" r="6" />
        <circle cx="74" cy="52" r="6" />
      </svg>
    </>
  );
}

/** Standalone doodle background layer (its own wrapper) for use without Aurora. */
export function Doodles({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <DoodleIcons />
    </div>
  );
}
