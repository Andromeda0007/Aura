"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ResponseView } from "@/components/ai-panel/ResponseView";
import { AppHeader } from "@/components/layout/AppHeader";
import { Aurora } from "@/components/ui/aurora";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { libraryApi, type LibraryItem } from "@/lib/api";
import type { AIResponse } from "@/types";

const TYPES = ["all", "quiz", "summary", "explanation", "example", "diagram", "answer", "format_board"];

export default function LibraryPage() {
  const ready = useRequireAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    libraryApi.list().then(setItems).catch(() => toast.error("Could not load library"));
  }, [ready]);

  const filtered = useMemo(() => {
    return items.filter(
      (it) =>
        (type === "all" || it.type === type) &&
        (it.command.toLowerCase().includes(q.toLowerCase()) ||
          it.subject.toLowerCase().includes(q.toLowerCase())),
    );
  }, [items, q, type]);

  if (!ready) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />
      <div className="mx-auto w-full max-w-3xl px-6 pt-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything Aura has generated, in one place.</p>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search content…" className="pl-9" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                type === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {items.length === 0 ? "Nothing here yet — generate content in a session." : "No matches."}
            </p>
          ) : (
            filtered.map((it) => {
              const isOpen = open === it.commandId;
              return (
                <div key={it.commandId} className="rounded-2xl border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : it.commandId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium capitalize text-accent">
                      {it.type.replace("_", " ")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="text-muted-foreground">{it.subject} · </span>
                      {it.command}
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {it.timestamp ? formatDistanceToNow(new Date(it.timestamp), { addSuffix: true }) : ""}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border p-4">
                      <ResponseView response={{ type: it.type as AIResponse["type"], data: it.data }} />
                      <Link
                        href={`/classroom/${it.sessionId}`}
                        className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Open session →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
