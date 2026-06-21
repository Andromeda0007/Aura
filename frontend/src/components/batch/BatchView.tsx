"use client";

import { BookOpen, Layers, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/AppHeader";
import { Breadcrumbs, batchTitle } from "@/components/layout/Breadcrumbs";
import { LevelStatsPanel } from "@/components/stats/LevelStatsPanel";
import { AppBackdrop } from "@/components/ui/app-backdrop";
import { Button } from "@/components/ui/button";
import { CardActions } from "@/components/ui/card-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
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
const COLORS = Object.keys(DOT);

function detail(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof msg === "string" ? msg : fallback;
}

export function BatchView({ batchId }: { batchId: string }) {
  const ready = useRequireAuth();
  const isAdmin = useIsAdmin();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [depts, setDepts] = useState<DepartmentSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<DepartmentSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("indigo");
  const [deleting, setDeleting] = useState<DepartmentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
      await departmentApi.create({ batch_id: batchId, name: name.trim(), color: COLORS[depts.length % COLORS.length] });
      setName("");
      setShowForm(false);
      await refresh();
    } catch (e2) {
      toast.error(detail(e2, "Could not create department"));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(d: DepartmentSummary) {
    setEditing(d);
    setEditName(d.name);
    setEditColor(d.color);
    setErr("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await departmentApi.update(editing.id, { name: editName.trim(), color: editColor });
      setEditing(null);
      await refresh();
      toast.success("Saved");
    } catch (e2) {
      setErr(detail(e2, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await departmentApi.remove(deleting.id);
      setDeleting(null);
      await refresh();
      toast.success("Department deleted");
    } catch (e2) {
      toast.error(detail(e2, "Could not delete"));
    } finally {
      setBusy(false);
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
              <div key={d.id} className="group relative">
                <Link
                  href={`/department/${d.id}`}
                  className="block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
                >
                  <div className={cn("h-1.5 w-full", DOT[d.color] ?? DOT.indigo)} />
                  <div className="p-5">
                    <h3 className="font-display text-xl font-semibold leading-snug tracking-tight">{d.name}</h3>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {d.semesters} sem</span>
                      <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {d.courses} course{d.courses === 1 ? "" : "s"}</span>
                      <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> {d.tokensUsed.toLocaleString()} tok</span>
                    </div>
                  </div>
                </Link>
                <CardActions show={isAdmin} onEdit={() => openEdit(d)} onDelete={() => setDeleting(d)} />
              </div>
            ))
          )}
        </div>
      </main>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit department">
        <form onSubmit={saveEdit} className="space-y-4">
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Department name" />
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Color</span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setEditColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-card transition-all",
                  DOT[c],
                  editColor === c ? "ring-foreground" : "ring-transparent",
                )}
              />
            ))}
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title="Delete department?"
        message={
          deleting && (
            <>
              Permanently delete <span className="font-medium text-foreground">{deleting.name}</span> and its{" "}
              {deleting.semesters} semester{deleting.semesters === 1 ? "" : "s"} — including all their courses, units and
              sessions. This can’t be undone.
            </>
          )
        }
      />
    </div>
  );
}
