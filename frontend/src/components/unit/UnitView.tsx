"use client";

import { formatDistanceToNow } from "date-fns";
import { History, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle, type Crumb } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { Aurora } from "@/components/ui/aurora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCanWrite } from "@/hooks/useRole";
import { batchApi, courseApi, sessionApi, unitApi, type UnitDetail } from "@/lib/api";
import type { Session } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  paused: "bg-accent/15 text-accent",
  completed: "bg-muted text-muted-foreground",
};

export function UnitView({ unitId }: { unitId: string }) {
  const ready = useRequireAuth();
  const canWrite = useCanWrite();
  const router = useRouter();
  const [detail, setDetail] = useState<UnitDetail | null>(null);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Batches", href: "/dashboard" }]);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!ready) return;
    unitApi
      .get(unitId)
      .then(async (d) => {
        setDetail(d);
        try {
          const c = await courseApi.get(d.unit.course_id);
          const b = await batchApi.get(c.course.batch_id);
          setCrumbs([
            { label: "Batches", href: "/dashboard" },
            { label: batchTitle(b), href: `/batch/${b.id}` },
            { label: c.course.name, href: `/course/${c.course.id}` },
            { label: d.unit.name },
          ]);
        } catch {
          setCrumbs([{ label: "Batches", href: "/dashboard" }, { label: d.unit.name }]);
        }
      })
      .catch(() => toast.error("Unit not found"));
  }, [ready, unitId]);

  async function startSession(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setCreating(true);
    try {
      const s = await sessionApi.create(subject.trim(), unitId);
      router.push(`/classroom/${s.id}`);
    } catch {
      toast.error("Could not start session");
      setCreating(false);
    }
  }

  if (!ready || !detail) return null;
  const { unit, sessions } = detail;

  return (
    <div className="relative flex flex-1 flex-col">
      <Aurora className="opacity-40" />
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <Breadcrumbs items={crumbs} />

        <div className="mt-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{unit.name}</h1>
          {unit.description && <p className="mt-1 text-muted-foreground">{unit.description}</p>}
        </div>

        {canWrite && (
          <form onSubmit={startSession} className="mt-6 flex gap-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Start a session in this unit — e.g. Singly linked lists"
            />
            <Button type="submit" disabled={creating}>
              <Plus className="h-4 w-4" /> {creating ? "Starting…" : "Start"}
            </Button>
          </form>
        )}

        <h2 className="mt-8 text-lg font-semibold">Sessions</h2>
        <div className="mt-3 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet — start one above.</p>
          ) : (
            sessions.map((s: Session) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}>
                  {s.status}
                </span>
                <Link
                  href={`/session/${s.id}`}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted"
                  aria-label="Session history"
                  title="History & artifacts"
                >
                  <History className="h-4 w-4" /> History
                </Link>
                {canWrite && (
                  <Link
                    href={`/classroom/${s.id}`}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4" /> Open
                  </Link>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-8">
          <LevelStatsPanel load={() => unitApi.stats(unitId)} />
        </div>
      </main>
    </div>
  );
}
