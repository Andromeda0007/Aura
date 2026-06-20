"use client";

import { BarChart3, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { LevelStats } from "@/lib/api";
import { cn } from "@/lib/utils";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Collapsible analytics for any hierarchy level (unit/course/batch). */
export function LevelStatsPanel({ load }: { load: () => Promise<LevelStats> }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LevelStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      try {
        setData(await load());
      } catch {
        toast.error("Could not load stats");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
      >
        <BarChart3 className="h-4 w-4 text-primary" /> Stats
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border p-4">
          {loading || !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Kpi label="Sessions" value={data.totalSessions} />
                <Kpi label="Aura asks" value={data.totalCommands} />
                <Kpi label="Quizzes" value={data.totalQuizzes} />
                <Kpi label="Tokens" value={data.tokensUsed.toLocaleString()} />
                <Kpi label="Avg response" value={data.avgLatencyMs ? `${(data.avgLatencyMs / 1000).toFixed(1)}s` : "—"} />
              </div>

              {data.hardestConcepts.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Hardest concepts
                  </p>
                  <div className="space-y-1.5">
                    {data.hardestConcepts.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-danger" style={{ width: `${Math.round(h.missRate * 100)}%` }} />
                        </div>
                        <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                          {Math.round(h.missRate * 100)}%
                        </span>
                        <span className="min-w-0 truncate">{h.question}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
