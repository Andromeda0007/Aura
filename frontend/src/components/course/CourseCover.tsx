"use client";

import {
  Atom,
  Binary,
  BookOpen,
  Cpu,
  Database,
  FlaskConical,
  FunctionSquare,
  Globe,
  Network,
  Scale,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Preset course art: key -> gradient + icon. No uploads; teacher picks one.
export const COVERS: Record<string, { gradient: string; Icon: LucideIcon; label: string }> = {
  database: { gradient: "from-indigo-500 to-blue-600", Icon: Database, label: "Database" },
  network: { gradient: "from-sky-500 to-blue-600", Icon: Network, label: "Network" },
  chip: { gradient: "from-amber-500 to-orange-600", Icon: Cpu, label: "Hardware" },
  code: { gradient: "from-emerald-500 to-teal-600", Icon: Binary, label: "Code" },
  math: { gradient: "from-rose-500 to-pink-600", Icon: FunctionSquare, label: "Math" },
  science: { gradient: "from-fuchsia-500 to-rose-600", Icon: Atom, label: "Science" },
  chemistry: { gradient: "from-lime-500 to-green-600", Icon: FlaskConical, label: "Chemistry" },
  law: { gradient: "from-slate-500 to-slate-700", Icon: Scale, label: "Law / Theory" },
  world: { gradient: "from-teal-500 to-emerald-600", Icon: Globe, label: "Humanities" },
  book: { gradient: "from-stone-500 to-stone-700", Icon: BookOpen, label: "General" },
};

export const COVER_KEYS = Object.keys(COVERS);

export function coverOf(key: string) {
  return COVERS[key] ?? COVERS.book;
}

export function CourseCover({ coverKey, className }: { coverKey: string; className?: string }) {
  const { gradient, Icon } = coverOf(coverKey);
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-linear-to-br text-white/90",
        gradient,
        className,
      )}
    >
      <Icon className="h-8 w-8 opacity-90" />
      <Icon className="absolute -right-3 -bottom-3 h-20 w-20 opacity-10" />
    </div>
  );
}
