"use client";

import {
  Atom,
  Binary,
  BookOpen,
  Cpu,
  Database,
  FlaskConical,
  Globe,
  Network,
  Scale,
  Sigma,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Preset course art: key -> a calm accent tint + subject icon (no gradients).
// Teacher picks one; variety comes from the icon + tone, not saturated color.
export const COVERS: Record<string, { tint: string; fg: string; Icon: LucideIcon; label: string }> = {
  database: { tint: "bg-indigo-500/10", fg: "text-indigo-500", Icon: Database, label: "Database" },
  network: { tint: "bg-sky-500/10", fg: "text-sky-500", Icon: Network, label: "Network" },
  chip: { tint: "bg-amber-500/10", fg: "text-amber-600", Icon: Cpu, label: "Hardware" },
  code: { tint: "bg-emerald-500/10", fg: "text-emerald-600", Icon: Binary, label: "Code" },
  math: { tint: "bg-rose-500/10", fg: "text-rose-500", Icon: Sigma, label: "Math" },
  science: { tint: "bg-fuchsia-500/10", fg: "text-fuchsia-500", Icon: Atom, label: "Science" },
  chemistry: { tint: "bg-lime-500/10", fg: "text-lime-600", Icon: FlaskConical, label: "Chemistry" },
  law: { tint: "bg-slate-500/10", fg: "text-slate-500", Icon: Scale, label: "Law / Theory" },
  world: { tint: "bg-teal-500/10", fg: "text-teal-600", Icon: Globe, label: "Humanities" },
  book: { tint: "bg-stone-500/10", fg: "text-stone-500", Icon: BookOpen, label: "General" },
};

export const COVER_KEYS = Object.keys(COVERS);

export function coverOf(key: string) {
  return COVERS[key] ?? COVERS.book;
}

export function CourseCover({ coverKey, className }: { coverKey: string; className?: string }) {
  const { tint, fg, Icon } = coverOf(coverKey);
  return (
    <div className={cn("relative grid place-items-center overflow-hidden", tint, fg, className)}>
      <Icon className="h-8 w-8" />
      <Icon className="absolute -right-3 -bottom-3 h-20 w-20 opacity-10" />
    </div>
  );
}
