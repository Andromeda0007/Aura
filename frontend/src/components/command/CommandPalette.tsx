"use client";

import {
  BarChart3,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Library,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface Action {
  label: string;
  icon: typeof GraduationCap;
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const actions: Action[] = useMemo(() => {
    const go = (path: string) => () => {
      setOpen(false);
      router.push(path);
    };
    return [
      { label: "Batches", icon: GraduationCap, run: go("/dashboard"), keywords: "dashboard home class semester cohort" },
      { label: "Homework / assignments", icon: ClipboardList, run: go("/assignments"), keywords: "due submit" },
      { label: "Content library", icon: Library, run: go("/library") },
      { label: "Quiz results", icon: FileQuestion, run: go("/quizzes") },
      { label: "Stats", icon: BarChart3, run: go("/stats"), keywords: "analytics insights" },
      { label: "Settings", icon: Settings, run: go("/settings"), keywords: "profile account" },
      {
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: theme === "dark" ? Sun : Moon,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          setOpen(false);
        },
        keywords: "theme appearance",
      },
    ];
  }, [router, theme, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => `${a.label} ${a.keywords ?? ""}`.toLowerCase().includes(q));
  }, [actions, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-background/70 p-4 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              filtered[active]?.run();
            }
          }}
          placeholder="Type a command or search…"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm focus:outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            filtered.map((a, i) => (
              <button
                key={a.label}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={a.run}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  i === active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <a.icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
