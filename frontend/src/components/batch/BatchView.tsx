"use client";

import { Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { AppBackdrop } from "@/components/ui/app-backdrop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { batchApi, departmentApi, type Batch, type DepartmentSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
};

export function BatchView({ batchId }: { batchId: string }) {
  const ready = useRequireAuth();
  const isAdmin = useIsAdmin();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [depts, setDepts] = useState<DepartmentSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setDepts(await departmentApi.list(batchId));
  }

  useEffect(() => {
    if (!ready) return;
    batchApi.get(batchId).then(setBatch).catch(() => toast.error("Batch not found"));
    refresh().catch(() => toast.error("Could not load departments"));
  }, [ready, batchId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const palette = Object.keys(DOT);
      await departmentApi.create({ batch_id: batchId, name: name.trim(), color: palette[depts.length % palette.length] });
      setName("");
      setShowForm(false);
      await refresh();
    } catch {
      toast.error("Could not create department");
    } finally {
      setCreating(false);
    }
  }

  if (!ready || !batch) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <AppBackdrop />
      <AppHeader />

      <main className="mx-auto w-full flex-1 px-6 py-8 lg:px-[10%]">
        <Breadcrumbs items={[{ label: "Batches", href: "/dashboard" }, { label: batchTitle(batch) }]} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Batch {batch.start_year}–{batch.end_year}</h1>
            <p className="mt-1 text-muted-foreground">Departments in this admission batch.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" /> New department
            </Button>
          )}
        </div>

        {isAdmin && showForm && (
          <form onSubmit={create} className="mt-6 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department (e.g. Computer Science)" className="max-w-md" />
            <Button type="submit" disabled={creating}>{creating ? "Adding…" : "Add"}</Button>
          </form>
        )}

        <div className="mt-8">
          <LevelStatsPanel load={() => batchApi.stats(batchId)} />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {depts.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
              <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No departments yet</p>
              <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Add CS, IT, Mech… above (each gets Sem 1–8)." : "Nothing assigned here yet."}</p>
            </div>
          ) : (
            depts.map((d) => (
              <Link key={d.id} href={`/department/${d.id}`} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted">
                <span className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT[d.color] ?? DOT.indigo)} />
                <h3 className="mt-3 font-medium leading-snug">{d.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{d.semesters} semester{d.semesters === 1 ? "" : "s"}</p>
              </Link>
            ))
          )}
        </div>

      </main>
    </div>
  );
}
